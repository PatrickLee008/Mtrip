import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

const defaults = {
  host: '127.0.0.1',
  port: 56700,
  projectRoot: '..',
  deployDir: '../deploy',
  logsDir: '../deploy/logs',
  releaseInfoFile: '../deploy/release.json',
  dockerCommand: ['sudo', '-n', 'docker'],
  gatewayUrl: 'http://127.0.0.1:8081',
  enableActions: false,
  servicePorts: {
    'system-service': 9501,
    'user-service': 9502,
    'goods-service': 9503,
    'order-service': 9504,
    'merchant-service': 9505,
    'finance-service': 9506,
    'marketing-service': 9507,
    'payment-service': 9508
  },
  appPoolServices: [
    'system-service-app',
    'user-service-app',
    'goods-service-app',
    'order-service-app',
    'marketing-service-app'
  ],
  slowRequestMs: 1000,
  logTailLines: 200,
  defaultTheme: 'glass',
  defaultDensity: 'dense',
  themes: ['glass', 'classic-dark', 'pro-light', 'terminal']
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function envBool(name, fallback) {
  if (process.env[name] == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name]).toLowerCase());
}

export function loadConfig() {
  const file = process.env.MTRIP_OPS_CONFIG || path.join(appRoot, 'ops.config.json');
  const cfg = { ...defaults, ...readJson(file) };

  cfg.host = process.env.MTRIP_OPS_HOST || cfg.host;
  cfg.port = Number(process.env.MTRIP_OPS_PORT || cfg.port);
  cfg.enableActions = envBool('MTRIP_OPS_ENABLE_ACTIONS', Boolean(cfg.enableActions));

  cfg.appRoot = appRoot;
  cfg.projectRoot = path.resolve(appRoot, cfg.projectRoot);
  cfg.deployDir = path.resolve(appRoot, cfg.deployDir);
  cfg.logsDir = path.resolve(appRoot, cfg.logsDir);
  cfg.releaseInfoFile = path.resolve(appRoot, cfg.releaseInfoFile);
  cfg.dataDir = path.join(appRoot, 'data');
  cfg.auditLog = path.join(cfg.dataDir, 'audit.log');

  return cfg;
}

