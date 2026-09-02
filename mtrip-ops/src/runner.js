import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { knownServices } from './collectors.js';

/**
 * 部署超时:前端构建很慢(client-app 的 expo export 单独就要 1-2 分钟,
 * 首次还要 npm ci),默认 180s 会在部署中途被 KILL 掉。给 15 分钟。
 */
const DEPLOY_TIMEOUT = 15 * 60 * 1000;

/** 可作为 auto-deploy.sh 强制发布目标的前端工程(与该脚本的 FE_WEBS 一致) */
const FRONTEND_TARGETS = ['admin-web', 'merchant-web', 'supplier-web', 'client-app'];

const BASE_COMMANDS = {
  // 全自动:git fetch + ff-only 快进 + 按变更精准构建/重启(无变更则直接早退)
  'deploy-auto': (config) => ({ command: 'bash', args: ['scripts/auto-deploy.sh'], cwd: config.projectRoot, timeout: DEPLOY_TIMEOUT }),
  'deploy-dry-run': (config) => ({ command: 'bash', args: ['scripts/auto-deploy.sh', '--dry-run'], cwd: config.projectRoot, timeout: DEPLOY_TIMEOUT }),
  'mtrip-health': (config) => ({ command: 'bash', args: ['mtrip.sh', 'health'], cwd: config.deployDir }),
  'db-backup': (config) => ({ command: 'bash', args: ['scripts/db-backup.sh'], cwd: config.projectRoot, timeout: DEPLOY_TIMEOUT }),
  'git-fetch': (config) => ({ command: 'git', args: ['fetch', '--prune', 'origin'], cwd: config.projectRoot, timeout: 120000 }),
  'git-pull-ff-only': (config) => ({ command: 'git', args: ['pull', '--ff-only'], cwd: config.projectRoot, timeout: 120000 }),
  'git-status': (config) => ({ command: 'git', args: ['status', '-sb'], cwd: config.projectRoot })
};

/** auto-deploy.sh 允许的强制发布目标,按用途分组(渲染层直接拿来做 optgroup) */
export function deployTargetGroups(config) {
  return [
    { label: '前端(构建并发布静态产物)', targets: FRONTEND_TARGETS },
    { label: '后端主池(热重启)', targets: Object.keys(config.servicePorts) },
    { label: 'APP 孪生池(热重启)', targets: config.appPoolServices },
    { label: '网关', targets: ['gateway'] }
  ];
}

export function deployTargets(config) {
  return deployTargetGroups(config).flatMap((group) => group.targets);
}

/** 指定目标发布:scripts/auto-deploy.sh [--dry-run] <target> */
function deployTargetCommand(config, action, target) {
  if (!deployTargets(config).includes(target)) return null;
  const args = ['scripts/auto-deploy.sh'];
  if (action === 'deploy-target-dry') args.push('--dry-run');
  args.push(target);
  return { command: 'bash', args, cwd: config.projectRoot, timeout: DEPLOY_TIMEOUT };
}

function serviceCommand(config, action, service) {
  const allowed = new Set(knownServices(config));
  const allowedMtrip = [...Object.keys(config.servicePorts), ...config.appPoolServices, 'gateway', 'mysql', 'redis'];
  if (!allowed.has(service) || !allowedMtrip.includes(service)) return null;
  if (action === 'service-restart') return { command: 'bash', args: ['mtrip.sh', 'restart', service], cwd: config.deployDir };
  if (action === 'service-build') return { command: 'bash', args: ['mtrip.sh', 'build', service], cwd: config.deployDir };
  if (action === 'service-logs') return { command: 'bash', args: ['mtrip.sh', 'logs', service], cwd: config.deployDir, timeout: 12000 };
  return null;
}

function appendAudit(config, event) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
  return fs.mkdir(config.dataDir, { recursive: true }).then(() => fs.appendFile(config.auditLog, line));
}

/**
 * 执行白名单命令。
 * actor = { user, ip } —— 操作人与来源 IP,写进审计。
 * docs/03-安全模型.md「审计字段」要求这两项,在引入账号体系前一直是缺的。
 */
export async function runWhitelistedCommand(config, name, payload = {}, actor = {}) {
  const who = { user: actor.user || '-', ip: actor.ip || '-' };

  if (!config.enableActions) {
    return { ok: false, code: 403, stdout: '', stderr: 'Actions are disabled. Set enableActions=true to allow command execution.' };
  }

  let spec = BASE_COMMANDS[name]?.(config);
  if (!spec && ['service-restart', 'service-build', 'service-logs'].includes(name)) {
    spec = serviceCommand(config, name, String(payload.service || ''));
  }
  if (!spec && ['deploy-target', 'deploy-target-dry'].includes(name)) {
    spec = deployTargetCommand(config, name, String(payload.target || ''));
  }
  if (!spec) {
    // 未知/越权命令也要留痕:这类请求往往就是探测行为
    await appendAudit(config, { ...who, type: 'command-rejected', name, payload });
    return { ok: false, code: 404, stdout: '', stderr: `Unknown or forbidden command: ${name}` };
  }

  await appendAudit(config, { ...who, type: 'command-start', name, payload, command: spec.command, args: spec.args, cwd: spec.cwd });

  return new Promise((resolve) => {
    execFile(spec.command, spec.args, { cwd: spec.cwd, timeout: spec.timeout || 180000, maxBuffer: 1024 * 1024 * 4 }, async (error, stdout, stderr) => {
      const result = { ok: !error, code: error?.code ?? 0, stdout: String(stdout || ''), stderr: String(stderr || error?.message || '') };
      await appendAudit(config, { ...who, type: 'command-end', name, payload, ok: result.ok, code: result.code });
      resolve(result);
    });
  });
}
