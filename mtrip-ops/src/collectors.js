import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { execFile } from 'node:child_process';

export const REQUEST_RE = /request\.INFO:\s+([A-Z]+)\s+(\S+)\s+->\s+(\d{3})\s+\((\d+)ms\)/;


function commandSpec(value, fallback = 'docker') {
  if (Array.isArray(value) && value.length > 0) return { command: value[0], prefix: value.slice(1) };
  if (typeof value === 'string' && value.trim()) {
    const parts = value.trim().split(/\s+/);
    return { command: parts[0], prefix: parts.slice(1) };
  }
  return { command: fallback, prefix: [] };
}

function commandLabel(spec) {
  return [spec.command, ...spec.prefix].join(' ');
}

function execDocker(config, args, options = {}) {
  const spec = commandSpec(config.dockerCommand);
  return execFileAsync(spec.command, [...spec.prefix, ...args], options);
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    execFile(command, args, { timeout: 8000, maxBuffer: 1024 * 1024 * 2, ...options }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        signal: error?.signal || '',
        ms: Date.now() - started,
        stdout: String(stdout || ''),
        stderr: String(stderr || error?.message || '')
      });
    });
  });
}

function summarizeOutput(value, max = 1200) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

function dockerAdvice(config, checks, socketInfo) {
  const spec = commandSpec(config.dockerCommand);
  const allText = checks.map((check) => `${check.stderr}\n${check.stdout}`).join('\n').toLowerCase();
  const tips = [];

  if (spec.command === 'sudo' && !spec.prefix.includes('-n')) {
    tips.push('Web 进程建议使用非交互 sudo: dockerCommand 设为 ["sudo","-n","docker"],避免等待密码输入。');
  }
  if (allText.includes('permission denied') || allText.includes('/var/run/docker.sock')) {
    tips.push('当前用户无 Docker socket 权限:可将运行用户加入 docker 组后重新登录,或配置 sudo 免密白名单运行 docker。');
  }
  if (spec.command === 'sudo' && (allText.includes('password') || allText.includes('not in the sudoers'))) {
    tips.push('sudo 无法非交互执行:为 Ops 运行用户配置 NOPASSWD: /usr/bin/docker,或改用 docker-socket-proxy/受限 runner。');
  }
  if (allText.includes('cannot connect to the docker daemon') || allText.includes('is the docker daemon running')) {
    tips.push('Docker daemon 不可连接:确认 dockerd 已运行,并检查 DOCKER_HOST 或宿主 socket 挂载。');
  }
  if (socketInfo.exists === false) {
    tips.push('/var/run/docker.sock 不存在:如果 Ops 跑在容器内,需接入受限 socket proxy 或 runner。');
  }
  if (tips.length === 0) {
    tips.push('Docker 命令已可执行。若服务仍显示 unknown,查看 ps/stats/inspect 单项 stderr 与超时。');
  }
  return tips;
}

async function dockerSocketInfo() {
  try {
    const stat = await fs.stat('/var/run/docker.sock');
    return {
      exists: true,
      mode: `0${(stat.mode & 0o777).toString(8)}`,
      uid: stat.uid,
      gid: stat.gid
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

export async function collectDockerDiagnostics(config) {
  const spec = commandSpec(config.dockerCommand);
  const socket = await dockerSocketInfo();
  const checkDefs = [
    ['version', ['version', '--format', '{{.Server.Version}}'], 8000],
    ['ps', ['ps', '-a', '--format', '{{json .}}'], 12000],
    ['stats', ['stats', '--no-stream', '--format', '{{json .}}'], 12000]
  ];
  const checks = [];

  for (const [name, args, timeout] of checkDefs) {
    const result = await execDocker(config, args, { cwd: config.projectRoot, timeout });
    checks.push({
      name,
      args,
      ok: result.ok,
      code: result.code,
      signal: result.signal,
      ms: result.ms,
      stdout: summarizeOutput(result.stdout),
      stderr: summarizeOutput(result.stderr)
    });
  }

  return {
    ok: checks.every((check) => check.ok),
    command: commandLabel(spec),
    effectiveUser: {
      uid: typeof process.getuid === 'function' ? process.getuid() : null,
      gid: typeof process.getgid === 'function' ? process.getgid() : null,
      user: process.env.USER || process.env.LOGNAME || ''
    },
    socket,
    checks,
    advice: dockerAdvice(config, checks, socket)
  };
}

function requestJson(url, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, ms: Date.now() - started, body });
      });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (error) => {
      resolve({ ok: false, status: 0, ms: Date.now() - started, error: error.message });
    });
  });
}

export function knownServices(config) {
  return [
    'gateway',
    ...Object.keys(config.servicePorts),
    ...config.appPoolServices,
    'mysql',
    'redis'
  ];
}

export async function collectHealth(config) {
  const items = [];
  const gatewayUrl = `${config.gatewayUrl.replace(/\/$/, '')}/healthz`;
  items.push({ name: 'gateway', kind: 'gateway', url: gatewayUrl, ...(await requestJson(gatewayUrl)) });

  for (const [name, port] of Object.entries(config.servicePorts)) {
    const url = `http://127.0.0.1:${port}/healthz`;
    items.push({ name, kind: 'main-pool', url, ...(await requestJson(url)) });
  }

  for (const name of config.appPoolServices) {
    items.push({ name, kind: 'app-pool', url: 'internal only', ok: null, status: 'internal', ms: null });
  }

  return items;
}

export async function collectServiceStatus(config) {
  const result = await execFileAsync('bash', ['mtrip.sh', 'status'], { cwd: config.deployDir });
  return { ok: result.ok, output: result.stdout || result.stderr };
}


export async function collectDockerPs(config) {
  const result = await execDocker(config, ['ps', '-a', '--format', '{{json .}}'], { cwd: config.projectRoot, timeout: 12000 });
  const containers = new Map();
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout, containers };

  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const rawName = String(row.Names || row.Name || '');
      const name = rawName.replace(/^mtrip-/, '').replace(/-1$/, '');
      if (name) containers.set(name, row);
    } catch {
      // Ignore malformed docker output rows.
    }
  }
  return { ok: true, error: '', containers };
}

function normalizeContainerName(rawName) {
  return String(rawName || '').replace(/^\//, '').replace(/^mtrip-/, '').replace(/-1$/, '');
}

function parseEnv(env = []) {
  const out = {};
  for (const item of env) {
    const idx = String(item).indexOf('=');
    if (idx > 0) out[item.slice(0, idx)] = item.slice(idx + 1);
  }
  return out;
}

function firstValue(...values) {
  return values.find((value) => value != null && String(value).trim() !== '') || '';
}

function formatDate(value) {
  if (!value || String(value).startsWith('0001-')) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function formatDurationSince(value) {
  if (!value || String(value).startsWith('0001-')) return '';
  const start = new Date(value).getTime();
  if (Number.isNaN(start)) return '';
  let seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  if (days > 0) return `${days}天 ${hours}小时`;
  if (hours > 0) return `${hours}小时 ${minutes}分钟`;
  return `${minutes}分钟`;
}

export async function collectDockerInspect(config, dockerPs) {
  const names = [...dockerPs.containers.values()].map((row) => row.Names).filter(Boolean);
  const inspect = new Map();
  if (!dockerPs.ok || names.length === 0) return { ok: dockerPs.ok, error: dockerPs.error || '', inspect };
  const result = await execDocker(config, ['inspect', ...names], { cwd: config.projectRoot, timeout: 12000, maxBuffer: 1024 * 1024 * 4 });
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout, inspect };
  try {
    const rows = JSON.parse(result.stdout);
    for (const row of rows) {
      const name = normalizeContainerName(row.Name);
      inspect.set(name, row);
    }
    return { ok: true, error: '', inspect };
  } catch (error) {
    return { ok: false, error: error.message, inspect };
  }
}

export async function readReleaseInfo(config) {
  const empty = { global: {}, services: {} };
  try {
    return { ...empty, ...JSON.parse(await fs.readFile(config.releaseInfoFile, 'utf8')) };
  } catch {
    return empty;
  }
}

function releaseMetaFromInspect(row, manifestMeta = {}) {
  const labels = row?.Config?.Labels || {};
  const env = parseEnv(row?.Config?.Env || []);
  const startedAtRaw = row?.State?.StartedAt || '';
  const createdAtRaw = row?.Created || '';
  const image = firstValue(row?.Config?.Image, row?.Image);
  const gitSha = firstValue(
    manifestMeta.gitSha,
    labels['mtrip.release.git_sha'],
    labels['org.opencontainers.image.revision'],
    env.MTRIP_GIT_SHA,
    env.MTRIP_RELEASE_GIT_SHA
  );
  return {
    image,
    imageId: row?.Image || '',
    startedAt: formatDate(startedAtRaw),
    uptime: formatDurationSince(startedAtRaw),
    createdAt: formatDate(createdAtRaw),
    version: firstValue(manifestMeta.version, labels['mtrip.release.version'], labels['org.opencontainers.image.version'], env.MTRIP_RELEASE_VERSION),
    publishedAt: formatDate(firstValue(manifestMeta.publishedAt, labels['mtrip.release.time'], labels['org.opencontainers.image.created'], env.MTRIP_RELEASE_TIME)),
    gitSha: gitSha ? String(gitSha).slice(0, 12) : '',
    releaseNotes: firstValue(manifestMeta.notes, labels['mtrip.release.notes'], labels['org.opencontainers.image.description'], env.MTRIP_RELEASE_NOTES)
  };
}

function routeRisk(name, containerState) {
  if (!name.endsWith('-app')) return '';
  if (containerState === 'running') return '';
  if (containerState === 'unknown') return 'Docker unreadable; cannot verify APP upstream. /api/v1/app/* has no automatic fallback';
  if (containerState === 'missing') return '/api/v1/app/* fixed upstream may 502; no automatic fallback';
  return `/api/v1/app/* upstream is ${containerState}; may 502`;
}


function serviceRiskScore(row, dockerReadable) {
  if (row.health?.ok === false) return 1000;
  if (row.kind === 'app-pool' && row.routeRisk) return 900;
  if (dockerReadable && ['exited', 'dead', 'stopped', 'created', 'restarting', 'paused', 'missing'].includes(row.containerState)) return 800;
  if (row.logStats?.errors > 0) return 700 + row.logStats.errors;
  if (row.logStats?.slow > 0) return 500 + row.logStats.slow;
  if (row.containerState === 'unknown') return 150;
  if (row.health?.ok === null) return 100;
  return 0;
}

function servicePort(config, name) {
  if (name === 'gateway') return '80 / host 8081';
  if (name === 'mysql') return '3306 / host 3307';
  if (name === 'redis') return '6379 / host 6380';
  if (config.servicePorts[name]) return String(config.servicePorts[name]);
  const main = name.replace(/-app$/, '');
  if (config.servicePorts[main]) return `${config.servicePorts[main]} internal`;
  return '-';
}

export async function collectDockerStats(config) {
  const result = await execDocker(config, ['stats', '--no-stream', '--format', '{{json .}}'], { cwd: config.projectRoot, timeout: 12000 });
  const stats = new Map();
  if (!result.ok) return { ok: false, error: result.stderr || result.stdout, stats };

  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      const name = String(row.Name || row.Container || '').replace(/^mtrip-/, '').replace(/-1$/, '');
      if (name) stats.set(name, row);
    } catch {
      // Ignore malformed docker output rows.
    }
  }
  return { ok: true, error: '', stats };
}

async function walkFiles(root, maxDepth = 3, depth = 0) {
  let out = [];
  let entries = [];
  try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { return out; }

  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory() && depth < maxDepth) {
      out = out.concat(await walkFiles(full, maxDepth, depth + 1));
    } else if (entry.isFile() && /\.(log|txt)$/.test(entry.name)) {
      const stat = await fs.stat(full);
      out.push({ path: full, name: path.relative(root, full), service: path.relative(root, full).split(path.sep)[0], size: stat.size, mtimeMs: stat.mtimeMs });
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

export async function listLogFiles(config) {
  return walkFiles(config.logsDir);
}

export async function tailFile(file, lines = 200) {
  const data = await fs.readFile(file, 'utf8');
  return data.split(/\r?\n/).slice(-lines).join('\n');
}

export function parseRequestLine(line) {
  const match = line.match(REQUEST_RE);
  if (!match) return null;
  const [, method, apiPath, statusText, msText] = match;
  return { method, path: apiPath, status: Number(statusText), ms: Number(msText) };
}

export async function searchLogs(config, filters = {}) {
  const maxLines = Number(filters.maxLines || 2000);
  const query = String(filters.q || '').trim().toLowerCase();
  const status = String(filters.status || '').trim();
  const service = String(filters.service || '').trim();
  const fileFilter = String(filters.file || '').trim();
  const onlySlow = filters.slow === '1' || filters.slow === true;
  const onlyErrors = filters.errors === '1' || filters.errors === true;

  let files = await listLogFiles(config);
  if (service) files = files.filter((file) => file.service === service);
  if (fileFilter) files = files.filter((file) => file.path === fileFilter);
  files = files.slice(0, 40);

  const rows = [];
  for (const file of files) {
    const content = await tailFile(file.path, maxLines).catch(() => '');
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) continue;
      const parsed = parseRequestLine(line);
      if (query && !line.toLowerCase().includes(query)) continue;
      if (status && (!parsed || String(parsed.status) !== status)) continue;
      if (onlySlow && (!parsed || parsed.ms < config.slowRequestMs)) continue;
      if (onlyErrors && (!parsed || parsed.status < 500)) continue;
      rows.push({ file: file.name, service: file.service, lineNo: index + 1, line, parsed });
      if (rows.length >= 500) return { rows, files };
    }
  }
  return { rows, files };
}

export async function collectTraffic(config) {
  const files = (await listLogFiles(config)).filter((file) => /request-\d{4}-\d{2}-\d{2}\.log$/.test(file.name)).slice(0, 30);
  const stats = {
    total: 0,
    slow: 0,
    errors: 0,
    statuses: {},
    topPaths: {},
    byService: {},
    slowSamples: [],
    errorSamples: []
  };

  for (const file of files) {
    const content = await tailFile(file.path, 2000).catch(() => '');
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseRequestLine(line);
      if (!parsed) continue;
      const key = `${parsed.method} ${parsed.path.split('?')[0]}`;
      const serviceStats = stats.byService[file.service] || { total: 0, slow: 0, errors: 0, lastMs: 0, statuses: {} };
      stats.total += 1;
      serviceStats.total += 1;
      serviceStats.lastMs = parsed.ms;
      stats.statuses[parsed.status] = (stats.statuses[parsed.status] || 0) + 1;
      serviceStats.statuses[parsed.status] = (serviceStats.statuses[parsed.status] || 0) + 1;
      stats.topPaths[key] = (stats.topPaths[key] || 0) + 1;
      if (parsed.status >= 500) {
        stats.errors += 1;
        serviceStats.errors += 1;
        if (stats.errorSamples.length < 8) stats.errorSamples.push({ service: file.service, key, status: parsed.status, ms: parsed.ms });
      }
      if (parsed.ms >= config.slowRequestMs) {
        stats.slow += 1;
        serviceStats.slow += 1;
        if (stats.slowSamples.length < 8) stats.slowSamples.push({ service: file.service, key, status: parsed.status, ms: parsed.ms });
      }
      stats.byService[file.service] = serviceStats;
    }
  }

  stats.topPaths = Object.entries(stats.topPaths)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([key, count]) => ({ key, count }));
  return stats;
}

export async function collectServiceMatrix(config) {
  const [health, traffic, docker, dockerPs, releaseInfo, dockerDiagnostics] = await Promise.all([
    collectHealth(config),
    collectTraffic(config),
    collectDockerStats(config),
    collectDockerPs(config),
    readReleaseInfo(config),
    collectDockerDiagnostics(config)
  ]);
  const dockerInspect = await collectDockerInspect(config, dockerPs);
  const matrix = knownServices(config).map((name) => {
    const h = health.find((item) => item.name === name) || { ok: null, kind: name.endsWith('-app') ? 'app-pool' : 'infra' };
    const logStats = traffic.byService[name] || { total: 0, slow: 0, errors: 0, statuses: {} };
    const container = docker.stats.get(name) || docker.stats.get(name.replace('-service', '')) || null;
    const ps = dockerPs.containers.get(name) || dockerPs.containers.get(name.replace('-service', '')) || null;
    const inspect = dockerInspect.inspect.get(name) || dockerInspect.inspect.get(name.replace('-service', '')) || null;
    const state = !dockerPs.ok ? 'unknown' : (ps ? String(ps.State || ps.Status || '').toLowerCase() : 'missing');
    const manifestMeta = releaseInfo.services?.[name] || releaseInfo.services?.[name.replace(/-app$/, '')] || releaseInfo.global || {};
    return {
      name,
      kind: h.kind || 'infra',
      port: servicePort(config, name),
      health: h,
      logStats,
      container,
      ps,
      inspect,
      release: releaseMetaFromInspect(inspect, manifestMeta),
      containerState: state,
      containerStatus: !dockerPs.ok ? (dockerPs.error || 'docker unavailable') : (ps?.Status || 'missing'),
      routeRisk: routeRisk(name, state)
    };
  });
  const dockerReadable = dockerPs.ok;
  matrix.sort((a, b) => {
    const riskDiff = serviceRiskScore(b, dockerReadable) - serviceRiskScore(a, dockerReadable);
    if (riskDiff !== 0) return riskDiff;
    return a.name.localeCompare(b.name);
  });
  const appPoolRisk = matrix.filter((row) => row.kind === 'app-pool' && row.containerState !== 'running');
  return {
    matrix,
    dockerOk: docker.ok,
    dockerError: docker.error,
    dockerPsOk: dockerPs.ok,
    dockerPsError: dockerPs.error,
    dockerInspectOk: dockerInspect.ok,
    dockerInspectError: dockerInspect.error,
    dockerDiagnostics,
    appPoolRisk,
    traffic
  };
}

export async function readAudit(config, lines = 200) {
  const content = await fs.readFile(config.auditLog, 'utf8').catch(() => '');
  return content.split(/\r?\n/).filter(Boolean).slice(-lines).reverse();
}


export async function collectGitInfo(config) {
  const run = (args) => execFileAsync('git', args, { cwd: config.projectRoot, timeout: 12000, maxBuffer: 1024 * 1024 });
  const [branch, sha, status, remote, log] = await Promise.all([
    run(['rev-parse', '--abbrev-ref', 'HEAD']),
    run(['rev-parse', '--short=12', 'HEAD']),
    run(['status', '--short']),
    run(['status', '-sb']),
    run(['log', '--oneline', '-8'])
  ]);
  const remoteLine = remote.stdout.split(/\r?\n/)[0] || '';
  const dirtyFiles = status.stdout.split(/\r?\n/).filter(Boolean);
  return {
    ok: branch.ok && sha.ok,
    branch: branch.stdout.trim() || 'unknown',
    sha: sha.stdout.trim() || 'unknown',
    dirty: dirtyFiles.length > 0,
    dirtyCount: dirtyFiles.length,
    dirtyFiles: dirtyFiles.slice(0, 20),
    remoteLine,
    log: log.stdout.trim(),
    error: [branch.stderr, sha.stderr, status.stderr, remote.stderr].filter(Boolean).join('\n')
  };
}
