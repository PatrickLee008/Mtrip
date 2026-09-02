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
import { renderActions, renderAudit, renderDashboard, renderDocs, renderLogs, renderMarkdownDoc, renderServices } from './render.js';
import { runWhitelistedCommand } from './runner.js';

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

async function renderActionsWithResult(res, result, selectedService = '') {
  const git = await collectGitInfo(config);
  send(res, 200, renderActions({ config, result, services, selectedService, git }));
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (url.pathname.startsWith('/public/')) {
      await serveStatic(res, url.pathname);
      return;
    }

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
      send(res, 200, renderDashboard({ health, status, traffic, config }));
      return;
    }

    if (url.pathname === '/services') {
      const matrix = await collectServiceMatrix(config);
      send(res, 200, renderServices({ ...matrix, services }));
      return;
    }

    if (url.pathname === '/logs') {
      const filters = filtersFrom(url);
      const [files, search] = await Promise.all([listLogFiles(config), searchLogs(config, filters)]);
      const selected = filters.file || safeLogPath(url.searchParams.get('file'));
      const content = selected ? await tailFile(selected, config.logTailLines).catch((error) => error.message) : '';
      send(res, 200, renderLogs({ files, services, filters, rows: search.rows, selected, content, config }));
      return;
    }

    if (url.pathname === '/actions' && req.method === 'GET') {
      const git = await collectGitInfo(config);
      send(res, 200, renderActions({ config, services, selectedService: url.searchParams.get('service') || '', git }));
      return;
    }



    if (url.pathname === '/actions/git-fetch' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'git-fetch'));
      return;
    }

    if (url.pathname === '/actions/git-pull-ff-only' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'git-pull-ff-only'));
      return;
    }

    if (url.pathname === '/actions/git-status' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'git-status'));
      return;
    }

    if (url.pathname === '/actions/deploy-dry-run' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'deploy-dry-run'));
      return;
    }

    if (url.pathname === '/actions/mtrip-health' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'mtrip-health'));
      return;
    }

    if (url.pathname === '/actions/db-backup' && req.method === 'POST') {
      await renderActionsWithResult(res, await runWhitelistedCommand(config, 'db-backup'));
      return;
    }

    if (url.pathname === '/actions/service' && req.method === 'POST') {
      const form = await readForm(req);
      const service = String(form.get('service') || '');
      const command = String(form.get('command') || '');
      await renderActionsWithResult(res, await runWhitelistedCommand(config, command, { service }), service);
      return;
    }

    if (url.pathname === '/audit') {
      send(res, 200, renderAudit({ lines: await readAudit(config) }));
      return;
    }

    if (url.pathname === '/docs') {
      send(res, 200, renderDocs());
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
      send(res, 200, renderMarkdownDoc(docName, markdown));
      return;
    }

    send(res, 404, 'not found');
  } catch (error) {
    send(res, 500, `<pre>${String(error.stack || error.message)}</pre>`);
  }
}

await fs.mkdir(config.dataDir, { recursive: true });

http.createServer(handle).listen(config.port, config.host, () => {
  console.log(`Mtrip Ops listening on http://${config.host}:${config.port}`);
});
