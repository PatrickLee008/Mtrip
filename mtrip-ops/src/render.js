import path from 'node:path';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nav() {
  return `
    <a href="/">总览</a>
    <a href="/services">服务</a>
    <a href="/logs">日志</a>
    <a href="/actions">发布</a>
    <a href="/audit">审计</a>
    <a href="/docs">计划</a>`;
}

function themeSwitcher() {
  return `<div class="theme-switcher" role="group" aria-label="主题切换">
    <label>界面模板<select id="themeSelect" data-theme-select>
      <option value="glass">玻璃</option>
      <option value="classic-dark">黑色经典</option>
      <option value="pro-light">浅色专业</option>
      <option value="terminal">终端矩阵</option>
    </select></label>
    <label>显示密度<select id="densitySelect" data-density-select>
      <option value="dense">紧凑</option>
      <option value="roomy">舒展</option>
    </select></label>
  </div>`;
}

export function layout(title, body) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Mtrip Ops</title>
  <link rel="stylesheet" href="/public/app.css">
</head>
<body>
  <script>
    const opsTheme = localStorage.getItem('mtrip-ops-theme') || 'glass';
    const opsDensity = localStorage.getItem('mtrip-ops-density') || 'dense';
    document.body.dataset.theme = opsTheme;
    document.body.dataset.density = opsDensity;
  </script>
  <div class="shell">
    <aside class="rail">
      <div class="brand"><span class="brand-mark">MO</span><div><strong>Mtrip Ops</strong><small>Control room</small></div></div>
      <nav>${nav()}</nav>
      ${themeSwitcher()}
    </aside>
    <main class="main">${body}</main>
  </div>
  <script src="/public/app.js"></script>
</body>
</html>`;
}

function healthBadge(item) {
  if (item.ok === null) return '<span class="badge neutral">内网待接</span>';
  return item.ok ? '<span class="badge good">OK</span>' : '<span class="badge bad">FAIL</span>';
}

function serviceScore(row) {
  if (row.health.ok === false) return 'danger';
  if (row.logStats.errors > 0 || row.logStats.slow > 0) return 'warn';
  if (row.health.ok === true) return 'good';
  return 'neutral';
}

function commandOutput(result) {
  if (!result) return '尚未执行命令。默认禁用动作,需在 ops.config.json 设置 enableActions=true。';
  if (typeof result === 'string') return result;
  return `${result.stdout || ''}\n${result.stderr || ''}`.trim() || `(exit ${result.code})`;
}

function serviceOptions(services, selected = '') {
  return services.map((service) => `<option value="${escapeHtml(service)}" ${service === selected ? 'selected' : ''}>${escapeHtml(service)}</option>`).join('');
}

function renderDockerDiagnosticsCard(diagnostics) {
  if (!diagnostics) return '';
  const checks = diagnostics.checks.map((check) => `<tr><td><strong>${escapeHtml(check.name)}</strong><small>${escapeHtml(check.args.join(' '))}</small></td><td><span class="badge ${check.ok ? 'good' : 'bad'}">${check.ok ? 'OK' : 'FAIL'}</span></td><td>${escapeHtml(check.code)}</td><td>${escapeHtml(check.signal || '-')}</td><td>${escapeHtml(check.ms)}ms</td><td><code>${escapeHtml(check.stderr || check.stdout || '-')}</code></td></tr>`).join('');
  const advice = diagnostics.advice.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const socket = diagnostics.socket.exists
    ? `存在, mode=${escapeHtml(diagnostics.socket.mode)}, uid=${escapeHtml(diagnostics.socket.uid)}, gid=${escapeHtml(diagnostics.socket.gid)}`
    : `不存在或不可读: ${escapeHtml(diagnostics.socket.error || '-')}`;
  return `<section class="panel wide docker-diagnostics">
    <div class="panel-head"><h2>Docker 权限诊断</h2><a class="button secondary" href="/api/diagnostics/docker">查看 JSON</a></div>
    <div class="diag-summary"><span>命令: <code>${escapeHtml(diagnostics.command)}</code></span><span>运行用户: <code>${escapeHtml(diagnostics.effectiveUser.user || '-')}:${escapeHtml(diagnostics.effectiveUser.uid ?? '-')}/${escapeHtml(diagnostics.effectiveUser.gid ?? '-')}</code></span><span>socket: <code>${socket}</code></span></div>
    <ul class="diag-advice">${advice}</ul>
    <table><thead><tr><th>检查项</th><th>结果</th><th>退出码</th><th>信号</th><th>耗时</th><th>输出/错误</th></tr></thead><tbody>${checks}</tbody></table>
  </section>`;
}

export function renderDashboard({ health, status, traffic, config }) {
  const failed = health.filter((item) => item.ok === false).length;
  const healthy = health.filter((item) => item.ok === true).length;
  const appPool = health.filter((item) => item.kind === 'app-pool').length;
  const cards = [
    ['健康服务', healthy, 'healthz 返回 2xx'],
    ['异常服务', failed, '需要查看日志或重启'],
    ['APP 孪生', appPool, '/api/v1/app/* 独立实例池'],
    ['请求样本', traffic.total, '最近日志 tail 聚合'],
    ['慢请求', traffic.slow, `阈值 ${config.slowRequestMs}ms`],
    ['5xx 错误', traffic.errors, '最近日志样本']
  ];

  const healthRows = health.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.kind)}</small></td>
      <td>${healthBadge(item)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${item.ms == null ? '-' : `${item.ms}ms`}</td>
      <td class="mono">${escapeHtml(item.url)}</td>
    </tr>`).join('');
  const topPaths = traffic.topPaths.map((item) => `<li><span>${escapeHtml(item.key)}</span><b>${item.count}</b></li>`).join('');
  const statuses = Object.entries(traffic.statuses).map(([statusCode, count]) => `<span class="chip">${escapeHtml(statusCode)}: ${count}</span>`).join('');

  return layout('总览', `
    <header class="hero">
      <div><p class="eyebrow">Mtrip operation cockpit</p><h1>平台态势总览</h1><p>读取当前部署目录: <code>${escapeHtml(config.deployDir)}</code></p></div>
      <div class="hero-actions"><a class="button secondary" href="/services">服务矩阵</a><a class="button" href="/actions">发布管理</a></div>
    </header>
    <section class="metrics">${cards.map(([label, value, hint]) => `<article><small>${label}</small><strong>${value}</strong><span>${hint}</span></article>`).join('')}</section>
    <section class="grid">
      <article class="panel wide"><div class="panel-head"><h2>服务健康</h2><span>${new Date().toLocaleString()}</span></div><table><thead><tr><th>服务</th><th>状态</th><th>HTTP</th><th>耗时</th><th>探测地址</th></tr></thead><tbody>${healthRows}</tbody></table></article>
      <article class="panel"><div class="panel-head"><h2>流量摘要</h2><span>request log</span></div><div class="chips">${statuses || '<span class="chip">暂无请求样本</span>'}</div><ul class="rank">${topPaths || '<li><span>暂无可解析日志</span><b>0</b></li>'}</ul></article>
      <article class="panel"><div class="panel-head"><h2>容器状态</h2><span>mtrip.sh status</span></div><pre>${escapeHtml(status.output || '暂无输出')}</pre></article>
    </section>`);
}

export function renderServices({ matrix, dockerOk, dockerError, dockerPsOk, dockerPsError, dockerInspectOk, dockerInspectError, dockerDiagnostics, appPoolRisk, services }) {
  const dockerBanner = (!dockerPsOk || !dockerOk) ? `<section class="risk-banner docker-risk"><strong>Docker 访问异常</strong><span>当前 Ops 进程无法读取 Docker API,容器状态/启动时间/运行时长/负载会显示 unknown 或 not available。当前配置支持 dockerCommand,本机需 sudo 时建议设为 [\"sudo\",\"-n\",\"docker\"] 并配置 NOPASSWD,避免 Web 进程等待密码。</span></section>` : '';
  const riskBanner = appPoolRisk.length ? `<section class="risk-banner"><strong>APP 路由风险</strong><span>${appPoolRisk.map((row) => escapeHtml(row.name)).join(', ')} 未运行、缺失或 Docker 状态不可读。当前网关 /api/v1/app/* 固定指向 APP 孪生池,不会自动回退主池,可能 502。</span></section>` : '';
  const rows = matrix.map((row) => {
    const stats = row.container;
    const stateClass = row.containerState === 'running' ? 'good' : row.containerState === 'missing' ? 'danger' : row.containerState === 'unknown' ? 'neutral' : 'warn';
    return `<article class="service-card ${serviceScore(row)}">
      <div class="service-title"><div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.kind)} · port ${escapeHtml(row.port)}</small></div>${healthBadge(row.health)}</div>
      <div class="service-state"><span class="badge ${stateClass}">${escapeHtml(row.containerState)}</span><code>${escapeHtml(row.containerStatus)}</code></div>
      ${row.routeRisk ? `<p class="risk-text">${escapeHtml(row.routeRisk)}</p>` : ''}
      <dl>
        <div><dt>版本</dt><dd>${escapeHtml(row.release.version || '未配置')}</dd></div>
        <div><dt>发布</dt><dd>${escapeHtml(row.release.publishedAt || '未配置')}</dd></div>
        <div><dt>启动</dt><dd>${escapeHtml(row.release.startedAt || '-')}</dd></div>
        <div><dt>运行时长</dt><dd>${escapeHtml(row.release.uptime || '-')}</dd></div>
        <div><dt>Git</dt><dd>${escapeHtml(row.release.gitSha || '未配置')}</dd></div>
        <div><dt>镜像</dt><dd title="${escapeHtml(row.release.image || '-')}">${escapeHtml(row.release.image || '-')}</dd></div>
        <div><dt>请求</dt><dd>${row.logStats.total}</dd></div>
        <div><dt>慢请求</dt><dd>${row.logStats.slow}</dd></div>
        <div><dt>5xx</dt><dd>${row.logStats.errors}</dd></div>
        <div><dt>Health</dt><dd>${row.health.ms == null ? '-' : `${row.health.ms}ms`}</dd></div>
        <div><dt>CPU</dt><dd>${escapeHtml(stats?.CPUPerc || '-')}</dd></div>
        <div><dt>内存</dt><dd>${escapeHtml(stats?.MemUsage || '-')}</dd></div>
        <div><dt>网络</dt><dd>${escapeHtml(stats?.NetIO || '-')}</dd></div>
        <div><dt>Block IO</dt><dd>${escapeHtml(stats?.BlockIO || '-')}</dd></div>
        <div><dt>PIDs</dt><dd>${escapeHtml(stats?.PIDs || '-')}</dd></div>
      </dl>
      <p class="release-note">${escapeHtml(row.release.releaseNotes || '发布说明未配置')}</p>
      <footer><a href="/logs?service=${encodeURIComponent(row.name)}">服务日志</a><a href="/actions?service=${encodeURIComponent(row.name)}">服务操作</a></footer>
    </article>`;
  }).join('');

  const tableRows = matrix.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.kind)}</small></td><td>${escapeHtml(row.port)}</td><td>${healthBadge(row.health)}</td><td>${escapeHtml(row.containerState)}</td><td>${escapeHtml(row.release.version || '未配置')}</td><td>${escapeHtml(row.release.publishedAt || '未配置')}</td><td>${escapeHtml(row.release.startedAt || '-')}</td><td>${escapeHtml(row.release.uptime || '-')}</td><td>${escapeHtml(row.container?.CPUPerc || '-')}</td><td>${escapeHtml(row.container?.MemUsage || '-')}</td><td>${row.logStats.total}</td><td>${row.logStats.slow}</td><td>${row.logStats.errors}</td><td>${escapeHtml(row.release.releaseNotes || '')}</td><td>${escapeHtml(row.routeRisk || '')}</td></tr>`).join('');

  return layout('服务', `
    <header class="page-head"><div><p class="eyebrow">Service observatory</p><h1>服务状态与负载</h1><p>Docker stats: <code>${dockerOk ? 'ok' : escapeHtml(dockerError || 'not available')}</code> · Docker ps: <code>${dockerPsOk ? 'ok' : escapeHtml(dockerPsError || 'not available')}</code> · inspect: <code>${dockerInspectOk ? 'ok' : escapeHtml(dockerInspectError || 'not available')}</code></p></div><a class="button" href="/logs">查日志</a></header>
    ${dockerBanner}
    ${riskBanner}
    ${renderDockerDiagnosticsCard(dockerDiagnostics)}
    <section class="service-grid">${rows}</section>
    <section class="panel wide dense-table"><div class="panel-head"><h2>全量服务表</h2><span>面向大平台的高密度视图</span></div><table><thead><tr><th>服务</th><th>端口</th><th>Health</th><th>容器</th><th>版本</th><th>发布时间</th><th>启动时间</th><th>运行时长</th><th>CPU</th><th>内存</th><th>请求</th><th>慢</th><th>5xx</th><th>说明</th><th>风险</th></tr></thead><tbody>${tableRows}</tbody></table></section>
    <section class="panel action-strip"><h2>快速跳转</h2><form method="get" action="/actions"><select name="service">${serviceOptions(services)}</select><button type="submit">打开服务操作</button></form></section>`);
}

export function renderLogs({ files, services, filters, rows, selected, content, config }) {
  const selectedFile = filters.file || selected || '';
  const serviceSelect = [''].concat(services).map((service) => `<option value="${escapeHtml(service)}" ${service === filters.service ? 'selected' : ''}>${service ? escapeHtml(service) : '全部服务'}</option>`).join('');
  const fileSelect = [''].concat(files.slice(0, 100).map((file) => file.path)).map((filePath) => {
    const label = filePath ? files.find((file) => file.path === filePath)?.name || filePath : '全部日志文件';
    return `<option value="${escapeHtml(filePath)}" ${filePath === selectedFile ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  const list = files.slice(0, 80).map((file) => {
    const active = selectedFile && path.resolve(selectedFile) === path.resolve(file.path) ? 'active' : '';
    return `<a class="${active}" href="/logs?file=${encodeURIComponent(file.path)}">${escapeHtml(file.name)}<small>${Math.round(file.size / 1024)} KB · ${escapeHtml(file.service)}</small></a>`;
  }).join('');
  const resultRows = rows.map((row) => `<tr><td>${escapeHtml(row.service)}</td><td>${escapeHtml(row.file)}:${row.lineNo}</td><td>${row.parsed ? `<span class="chip">${row.parsed.status}</span>` : '-'}</td><td>${row.parsed ? `${row.parsed.ms}ms` : '-'}</td><td><code>${escapeHtml(row.line)}</code></td></tr>`).join('');

  return layout('日志', `
    <header class="page-head"><div><p class="eyebrow">Log explorer</p><h1>日志中心</h1><p>来源: <code>${escapeHtml(config.logsDir)}</code></p></div></header>
    <section class="filter-panel">
      <form method="get" action="/logs">
        <input name="q" value="${escapeHtml(filters.q || '')}" placeholder="关键词 / API / 错误信息">
        <select name="service">${serviceSelect}</select>
        <select name="file">${fileSelect}</select>
        <input name="status" value="${escapeHtml(filters.status || '')}" placeholder="状态码,如 500">
        <label><input type="checkbox" name="slow" value="1" ${filters.slow ? 'checked' : ''}> 慢请求</label>
        <label><input type="checkbox" name="errors" value="1" ${filters.errors ? 'checked' : ''}> 仅 5xx</label>
        <button type="submit">搜索</button>
      </form>
    </section>
    <section class="logs enhanced">
      <aside class="log-list">${list || '<p>未发现日志文件</p>'}</aside>
      <article class="log-results">
        <div class="panel-head"><h2>搜索结果</h2><span>最多 500 行</span></div>
        <table><thead><tr><th>服务</th><th>位置</th><th>状态</th><th>耗时</th><th>内容</th></tr></thead><tbody>${resultRows || '<tr><td colspan="5">暂无命中。可输入关键词、状态码或勾选慢请求/5xx。</td></tr>'}</tbody></table>
        <div class="panel-head tail-head"><h2>文件 Tail</h2><span>${selectedFile ? escapeHtml(selectedFile) : '未选择文件'}</span></div>
        <pre>${escapeHtml(content || '选择左侧日志文件查看 tail 内容')}</pre>
      </article>
    </section>`);
}

export function renderActions({ config, result, services, selectedService, git }) {
  return layout('发布', `
    <header class="page-head"><div><p class="eyebrow">Release desk</p><h1>发布管理</h1><p>动作开关: <code>enableActions=${escapeHtml(config.enableActions)}</code>。正式环境建议只在 VPN/堡垒机内打开。</p></div><a class="button secondary" href="/audit">查看审计</a></header>
    <section class="release-flow">
      <div><b>1</b><span>Git 拉取/状态</span></div><div><b>2</b><span>部署 dry-run</span></div><div><b>3</b><span>数据库备份</span></div><div><b>4</b><span>部署/单服务操作</span></div><div><b>5</b><span>Health 验证</span></div>
    </section>
    <section class="release-grid">
      <article class="panel release-card git-card"><h2>Git 仓库</h2><p>当前分支 <code>${escapeHtml(git?.branch || 'unknown')}</code> · HEAD <code>${escapeHtml(git?.sha || 'unknown')}</code></p><div class="git-state ${git?.dirty ? 'dirty' : 'clean'}">${git?.dirty ? `工作区有 ${git.dirtyCount} 个改动,ff-only 发布应先处理` : '工作区干净'}</div><p class="mono small-text">${escapeHtml(git?.remoteLine || '')}</p><form method="post" action="/actions/git-status"><button class="secondary" type="submit">Git 状态</button></form><form method="post" action="/actions/git-fetch"><button class="secondary" type="submit">Fetch</button></form><form method="post" action="/actions/git-pull-ff-only"><button type="submit">Pull --ff-only</button></form></article>
      <article class="panel release-card"><h2>全局发布预检</h2><p>执行 <code>scripts/auto-deploy.sh --dry-run</code>,查看 Git 拉取后的精准构建/重启决策。</p><form method="post" action="/actions/deploy-dry-run"><button type="submit">执行 dry-run</button></form></article>
      <article class="panel release-card"><h2>发布前备份</h2><p>执行 <code>scripts/db-backup.sh</code>,生成 MySQL 逻辑备份。</p><form method="post" action="/actions/db-backup"><button class="secondary" type="submit">执行备份</button></form></article>
      <article class="panel release-card"><h2>全局健康检查</h2><p>执行 <code>deploy/mtrip.sh health</code>,验证主池、网关与 APP 孪生池。</p><form method="post" action="/actions/mtrip-health"><button class="secondary" type="submit">执行 health</button></form></article>
      <article class="panel release-card service-action"><h2>单服务操作</h2><p>用于灰度式处理单个服务:看日志、热重启、单服务 build。动作均走服务白名单。</p><form method="post" action="/actions/service"><select name="service">${serviceOptions(services, selectedService)}</select><select name="command"><option value="service-logs">查看容器日志</option><option value="service-restart">热重启服务</option><option value="service-build">单服务 build</option></select><button type="submit">执行</button></form></article>
      <article class="panel wide git-log"><div class="panel-head"><h2>最近提交</h2><span>git log --oneline -8</span></div><pre>${escapeHtml(git?.log || git?.error || '暂无 Git 信息')}</pre></article>
      <article class="panel wide"><div class="panel-head"><h2>命令输出</h2><span>audit: data/audit.log</span></div><pre>${escapeHtml(commandOutput(result))}</pre></article>
    </section>`);
}

export function renderAudit({ lines }) {
  const rows = lines.map((line) => {
    let row = {};
    try { row = JSON.parse(line); } catch { row = { raw: line }; }
    return `<tr><td>${escapeHtml(row.at || '-')}</td><td>${escapeHtml(row.type || '-')}</td><td>${escapeHtml(row.name || '-')}</td><td>${escapeHtml(JSON.stringify(row.payload || {}))}</td><td>${escapeHtml(row.ok ?? '')}</td><td><code>${escapeHtml(row.raw || JSON.stringify(row.args || []))}</code></td></tr>`;
  }).join('');
  return layout('审计', `
    <header class="page-head"><div><p class="eyebrow">Audit trail</p><h1>操作审计</h1><p>记录发布、备份、健康检查和服务操作的开始/结束事件。</p></div></header>
    <article class="panel wide"><table><thead><tr><th>时间</th><th>类型</th><th>动作</th><th>参数</th><th>结果</th><th>命令</th></tr></thead><tbody>${rows || '<tr><td colspan="6">暂无审计记录</td></tr>'}</tbody></table></article>`);
}

export function renderDocs() {
  return layout('计划', `
    <header class="page-head"><div><p class="eyebrow">Design documents</p><h1>设计与计划</h1><p>详细文档位于 <code>mtrip-ops/docs/</code>。</p></div></header>
    <section class="panel docs"><a href="/docs/01">01 方案设计</a><a href="/docs/02">02 实施计划</a><a href="/docs/03">03 安全模型</a><a href="/docs/04">04 成熟软件调研</a><a href="/docs/05">05 发布版本信息配置</a><a href="/docs/06">06 Git 发布流程</a><a href="/docs/07">07 下一步执行计划</a></section>`);
}

export function renderMarkdownDoc(title, markdown) {
  const html = escapeHtml(markdown)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^- \[x\] (.+)$/gm, '<p class="task done">✓ $1</p>')
    .replace(/^- \[ \] (.+)$/gm, '<p class="task">□ $1</p>')
    .replace(/^- (.+)$/gm, '<p class="bullet">• $1</p>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n{2,}/g, '\n');

  return layout(title, `
    <header class="page-head"><div><p class="eyebrow">Design document</p><h1>${escapeHtml(title)}</h1></div><a class="button secondary" href="/docs">返回计划</a></header>
    <article class="panel markdown">${html}</article>`);
}
