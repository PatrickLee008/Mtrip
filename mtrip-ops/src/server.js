import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { loadConfig } from './config.js';
import {
  collectHealth,
  collectServiceMatrix,
  collectServiceStatus,
  collectTraffic,
  collectGitInfo,
  collectDockerDiagnostics,
  knownServices,
  listLogFiles,
  readAudit,
  searchLogs,
  tailFile
} from './collectors.js';
import {
  renderActions,
  renderAudit,
  renderDashboard,
  renderDocs,
  renderForbidden,
  renderLogin,
  renderLogs,
  renderMarkdownDoc,
  renderServices,
  renderUsers
} from './render.js';
import { deployTargetGroups, runWhitelistedCommand } from './runner.js';
import {
  bootstrap,
  can,
  clearCookie,
  cookieName,
  createSession,
  createUser,
  deleteUser,
  destroySession,
  getSession,
  listUsers,
  parseCookies,
  sessionCookie,
  setDisabled,
  setPassword,
  setRole,
  verifyLogin
} from './auth.js';

const config = loadConfig();
const services = knownServices(config);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data, null, 2));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { location, ...headers });
  res.end();
}

async function serveStatic(res, pathname) {
  const file = path.join(config.appRoot, pathname);
  if (!file.startsWith(path.join(config.appRoot, 'public'))) {
    send(res, 403, 'forbidden');
    return;
  }
  const body = await fs.readFile(file);
  const type = pathname.endsWith('.css') ? 'text/css; charset=utf-8' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' });
  res.end(body);
}

function safeLogPath(file) {
  if (!file) return null;
  const resolved = path.resolve(file);
  const root = path.resolve(config.logsDir);
  return resolved.startsWith(root) ? resolved : null;
}

function readForm(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(new URLSearchParams(body)));
  });
}

function clientIp(req) {
  // 默认只绑 127.0.0.1;若前面挂了反代,请在反代上设置 X-Forwarded-For。
  // 注意该头可被伪造,仅用于审计展示,不作任何安全判定。
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || '-';
}

/**
 * 只接受 POST 的路径。登录后是用 302(GET)跳回 next 的,
 * 把这些路径塞进 next 会 404 —— 例如会话过期时用户正好点了「执行 health」,
 * next 就成了 /actions/mtrip-health,登录后 GET 它必然找不到。
 */
const POST_ONLY_PREFIXES = ['/actions/', '/users/', '/logout'];

/**
 * 登录后的跳转目标:必须是站内相对路径(防开放重定向),
 * 且必须是一个能用 GET 打开的页面(防跳到只收 POST 的动作端点)。
 */
function safeNext(value) {
  const next = String(value || '');
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  if (POST_ONLY_PREFIXES.some((prefix) => next.startsWith(prefix))) return '/';
  return next;
}

function filtersFrom(url) {
  return {
    q: url.searchParams.get('q') || '',
    service: url.searchParams.get('service') || '',
    file: safeLogPath(url.searchParams.get('file')) || '',
    status: url.searchParams.get('status') || '',
    slow: url.searchParams.get('slow') === '1',
    errors: url.searchParams.get('errors') === '1'
  };
}

async function renderActionsWithResult(res, user, result, selected = {}) {
  const git = await collectGitInfo(config);
  send(res, 200, renderActions({
    config,
    result,
    services,
    selectedService: selected.service || '',
    selectedTarget: selected.target || '',
    deployGroups: deployTargetGroups(config),
    git,
    user
  }));
}

// ---------------------------------------------------------------------------
// 鉴权处理
// ---------------------------------------------------------------------------

async function handleLogin(req, res, url) {
  if (req.method === 'GET') {
    send(res, 200, renderLogin({ next: safeNext(url.searchParams.get('next')) }));
    return;
  }

  const form = await readForm(req);
  const next = safeNext(form.get('next'));
  const ip = clientIp(req);
  const result = await verifyLogin(config, form.get('username'), form.get('password'), ip);

  if (!result.ok) {
    send(res, 401, renderLogin({ error: result.error, next }));
    return;
  }

  const sid = createSession(result.user, ip);
  redirect(res, next, { 'set-cookie': sessionCookie(sid) });
}

/**
 * 状态变更请求的 CSRF 校验。
 * cookie 已是 SameSite=Strict,这里是第二道 —— 该面板能跑 git pull 与重启服务,值得。
 */
function requireCsrf(form, session) {
  return String(form.get('csrf') || '') === session.csrf;
}

function denyCsrf(res, user) {
  send(res, 403, renderForbidden(user, 'CSRF 校验未通过。请回到页面重新提交,不要从外部站点发起该操作。'));
}

/** 账号管理的公共流程:校验 CSRF → 执行 → 回到 /users 并展示结果 */
async function handleUserAdmin(req, res, session, action) {
  const form = await readForm(req);
  if (!requireCsrf(form, session)) return denyCsrf(res, session);

  const username = String(form.get('username') || '');
  let result;
  if (action === 'create') {
    result = await createUser(config, {
      username,
      password: String(form.get('password') || ''),
      role: String(form.get('role') || 'viewer')
    });
  } else if (action === 'role') {
    result = await setRole(config, username, String(form.get('role') || ''));
  } else if (action === 'password') {
    result = await setPassword(config, username, String(form.get('password') || ''));
  } else if (action === 'toggle') {
    result = await setDisabled(config, username, form.get('disabled') === '1');
  } else {
    result = await deleteUser(config, username, session.username);
  }

  send(res, result.ok ? 200 : 400, renderUsers({
    users: listUsers(config),
    user: session,
    message: result.ok ? result.message : '',
    error: result.ok ? '' : result.error
  }));
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    // 静态资源:登录页也要能加载 CSS,故在鉴权之前放行
    if (url.pathname.startsWith('/public/')) {
      await serveStatic(res, url.pathname);
      return;
    }

    if (url.pathname === '/login') {
      await handleLogin(req, res, url);
      return;
    }

    // —— 以下全部需要登录 ——
    const sid = parseCookies(req.headers.cookie)[cookieName()];
    const session = getSession(config, sid);
    if (!session) {
      if (url.pathname.startsWith('/api/')) {
        sendJson(res, 401, { error: 'unauthorized' });
        return;
      }
      // 只有 GET 才值得记 next(POST 的动作端点跳回去也没意义,而且会 404);
      // safeNext 里还有一层兜底,两处都拦。
      const next = req.method === 'GET' ? safeNext(url.pathname + url.search) : '/';
      redirect(res, `/login?next=${encodeURIComponent(next)}`, { 'set-cookie': clearCookie() });
      return;
    }

    if (url.pathname === '/logout' && req.method === 'POST') {
      const form = await readForm(req);
      if (!requireCsrf(form, session)) return denyCsrf(res, session);
      destroySession(sid);
      redirect(res, '/login', { 'set-cookie': clearCookie() });
      return;
    }

    // 动作类:需要 action 权限 + CSRF。viewer 到此为止。
    if (url.pathname.startsWith('/actions/') && req.method === 'POST') {
      if (!can(session, 'action')) return send(res, 403, renderForbidden(session));
      const form = await readForm(req);
      if (!requireCsrf(form, session)) return denyCsrf(res, session);

      const actor = { user: session.username, ip: clientIp(req) };
      const simple = {
        '/actions/git-fetch': 'git-fetch',
        '/actions/git-pull-ff-only': 'git-pull-ff-only',
        '/actions/git-status': 'git-status',
        '/actions/deploy-auto': 'deploy-auto',
        '/actions/deploy-dry-run': 'deploy-dry-run',
        '/actions/mtrip-health': 'mtrip-health',
        '/actions/db-backup': 'db-backup'
      }[url.pathname];

      if (simple) {
        await renderActionsWithResult(res, session, await runWhitelistedCommand(config, simple, {}, actor));
        return;
      }
      if (url.pathname === '/actions/service') {
        const service = String(form.get('service') || '');
        const command = String(form.get('command') || '');
        await renderActionsWithResult(res, session, await runWhitelistedCommand(config, command, { service }, actor), { service });
        return;
      }
      if (url.pathname === '/actions/deploy-target') {
        const target = String(form.get('target') || '');
        // 同一个表单两个 submit 按钮:mode=dry 走预检,其余一律真发布
        const name = form.get('mode') === 'dry' ? 'deploy-target-dry' : 'deploy-target';
        await renderActionsWithResult(res, session, await runWhitelistedCommand(config, name, { target }, actor), { target });
        return;
      }
      send(res, 404, 'not found');
      return;
    }

    // 账号管理:仅 admin
    if (url.pathname.startsWith('/users')) {
      if (!can(session, 'admin')) return send(res, 403, renderForbidden(session));

      if (url.pathname === '/users' && req.method === 'GET') {
        send(res, 200, renderUsers({ users: listUsers(config), user: session }));
        return;
      }
      const action = {
        '/users/create': 'create',
        '/users/role': 'role',
        '/users/password': 'password',
        '/users/toggle': 'toggle',
        '/users/delete': 'delete'
      }[url.pathname];
      if (action && req.method === 'POST') {
        await handleUserAdmin(req, res, session, action);
        return;
      }
      send(res, 404, 'not found');
      return;
    }

    // —— 以下为只读页面,viewer 即可 ——
    if (url.pathname === '/api/health') {
      sendJson(res, 200, await collectHealth(config));
      return;
    }

    if (url.pathname === '/api/services') {
      sendJson(res, 200, await collectServiceMatrix(config));
      return;
    }

    if (url.pathname === '/api/diagnostics/docker') {
      sendJson(res, 200, await collectDockerDiagnostics(config));
      return;
    }

    if (url.pathname === '/') {
      const [health, status, traffic] = await Promise.all([collectHealth(config), collectServiceStatus(config), collectTraffic(config)]);
      send(res, 200, renderDashboard({ health, status, traffic, config, user: session }));
      return;
    }

    if (url.pathname === '/services') {
      const matrix = await collectServiceMatrix(config);
      send(res, 200, renderServices({ ...matrix, services, user: session }));
      return;
    }

    if (url.pathname === '/logs') {
      const filters = filtersFrom(url);
      const [files, search] = await Promise.all([listLogFiles(config), searchLogs(config, filters)]);
      const selected = filters.file || safeLogPath(url.searchParams.get('file'));
      const content = selected ? await tailFile(selected, config.logTailLines).catch((error) => error.message) : '';
      send(res, 200, renderLogs({ files, services, filters, rows: search.rows, selected, content, config, user: session }));
      return;
    }

    // 发布页本身也要 action 权限,否则 viewer 能看到所有按钮却一点就 403
    if (url.pathname === '/actions' && req.method === 'GET') {
      if (!can(session, 'action')) return send(res, 403, renderForbidden(session));
      const git = await collectGitInfo(config);
      send(res, 200, renderActions({
        config,
        services,
        selectedService: url.searchParams.get('service') || '',
        selectedTarget: url.searchParams.get('target') || '',
        deployGroups: deployTargetGroups(config),
        git,
        user: session
      }));
      return;
    }

    if (url.pathname === '/audit') {
      send(res, 200, renderAudit({ lines: await readAudit(config), user: session }));
      return;
    }

    if (url.pathname === '/docs') {
      send(res, 200, renderDocs(session));
      return;
    }

    const docMatch = url.pathname.match(/^\/docs\/(0[1-7])$/);
    if (docMatch) {
      const map = {
        '01': '01-方案设计.md',
        '02': '02-实施计划.md',
        '03': '03-安全模型.md',
        '04': '04-成熟软件调研.md',
        '05': '05-发布版本信息配置.md',
        '06': '06-Git发布流程.md',
        '07': '07-下一步执行计划.md'
      };
      const docName = map[docMatch[1]];
      const file = path.join(config.appRoot, 'docs', docName);
      const markdown = await fs.readFile(file, 'utf8');
      send(res, 200, renderMarkdownDoc(docName, markdown, session));
      return;
    }

    send(res, 404, 'not found');
  } catch (error) {
    send(res, 500, `<pre>${String(error.stack || error.message)}</pre>`);
  }
}

await fs.mkdir(config.dataDir, { recursive: true });
await bootstrap(config);

http.createServer(handle).listen(config.port, config.host, () => {
  console.log(`Mtrip Ops listening on http://${config.host}:${config.port}`);
});
