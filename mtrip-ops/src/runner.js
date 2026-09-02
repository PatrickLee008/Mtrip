import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { knownServices } from './collectors.js';

const BASE_COMMANDS = {
  'deploy-dry-run': (config) => ({ command: 'bash', args: ['scripts/auto-deploy.sh', '--dry-run'], cwd: config.projectRoot }),
  'mtrip-health': (config) => ({ command: 'bash', args: ['mtrip.sh', 'health'], cwd: config.deployDir }),
  'db-backup': (config) => ({ command: 'bash', args: ['scripts/db-backup.sh'], cwd: config.projectRoot }),
  'git-fetch': (config) => ({ command: 'git', args: ['fetch', '--prune', 'origin'], cwd: config.projectRoot, timeout: 120000 }),
  'git-pull-ff-only': (config) => ({ command: 'git', args: ['pull', '--ff-only'], cwd: config.projectRoot, timeout: 120000 }),
  'git-status': (config) => ({ command: 'git', args: ['status', '-sb'], cwd: config.projectRoot })
};

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

export async function runWhitelistedCommand(config, name, payload = {}) {
  if (!config.enableActions) {
    return { ok: false, code: 403, stdout: '', stderr: 'Actions are disabled. Set enableActions=true to allow command execution.' };
  }

  let spec = BASE_COMMANDS[name]?.(config);
  if (!spec && ['service-restart', 'service-build', 'service-logs'].includes(name)) {
    spec = serviceCommand(config, name, String(payload.service || ''));
  }
  if (!spec) return { ok: false, code: 404, stdout: '', stderr: `Unknown or forbidden command: ${name}` };

  await appendAudit(config, { type: 'command-start', name, payload, command: spec.command, args: spec.args, cwd: spec.cwd });

  return new Promise((resolve) => {
    execFile(spec.command, spec.args, { cwd: spec.cwd, timeout: spec.timeout || 180000, maxBuffer: 1024 * 1024 * 4 }, async (error, stdout, stderr) => {
      const result = { ok: !error, code: error?.code ?? 0, stdout: String(stdout || ''), stderr: String(stderr || error?.message || '') };
      await appendAudit(config, { type: 'command-end', name, payload, ok: result.ok, code: result.code });
      resolve(result);
    });
  });
}
