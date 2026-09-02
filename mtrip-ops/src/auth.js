/**
 * Mtrip Ops 账号与权限
 * ---------------------------------------------------------------------------
 * 零依赖(与本项目一致,只用 node: 内置模块):
 *   - 口令用 scrypt 加盐哈希,校验走 timingSafeEqual,绝不明文存储。
 *   - 会话是「进程内 Map + 32 字节随机 sid」。sid 本身不可猜且只在服务端查表,
 *     所以 cookie 不需要再签名。代价是【进程重启即全部登出】—— 简单方案的已知取舍。
 *
 * 三角色对应 docs/03-安全模型.md 已定义的风险分级:
 *   viewer   只读页面
 *   operator + 白名单动作(git / dry-run / 备份 / health / 单服务重启)
 *   admin    + 账号管理
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

export const ROLES = ['viewer', 'operator', 'admin'];

export const ROLE_LABELS = {
  viewer: '只读',
  operator: '运维',
  admin: '管理员'
};

/** 角色 → 权限键。上层一律用 can(user, perm) 判定,不要在路由里直接比对角色名。 */
const ROLE_PERMISSIONS = {
  viewer: ['view'],
  operator: ['view', 'action'],
  admin: ['view', 'action', 'admin']
};

const SESSION_COOKIE = 'mtrip_ops_sid';
/** 会话空闲超时:8 小时未活动即失效 */
const SESSION_IDLE_MS = 8 * 60 * 60 * 1000;
/** 登录失败锁定:同一「用户名+IP」连错 5 次锁 5 分钟 */
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

const sessions = new Map();
const loginFailures = new Map();

// ---------------------------------------------------------------------------
// 口令
// ---------------------------------------------------------------------------

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, expectedHex) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex');
  const expected = Buffer.from(String(expectedHex || ''), 'hex');
  // timingSafeEqual 要求等长,长度不等直接判否(长度本身不是秘密)
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/** 生成人可抄写的随机口令(去掉 0/O/1/l/I 等易混字符) */
function generatePassword(length = 16) {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

// ---------------------------------------------------------------------------
// 用户存储(data/users.json,data/.gitignore 已全量忽略,不会进 Git)
// ---------------------------------------------------------------------------

function usersFile(config) {
  return path.join(config.dataDir, 'users.json');
}

function readStore(config) {
  try {
    const parsed = JSON.parse(fs.readFileSync(usersFile(config), 'utf8'));
    return Array.isArray(parsed?.users) ? parsed : { users: [] };
  } catch (error) {
    if (error.code === 'ENOENT') return { users: [] };
    throw error;
  }
}

async function writeStore(config, store) {
  await fsp.mkdir(config.dataDir, { recursive: true });
  // 0600:只有运行用户可读写。里面是 salt/hash,虽非明文也不该让同机其他用户看到。
  await fsp.writeFile(usersFile(config), JSON.stringify(store, null, 2) + '\n', { mode: 0o600 });
}

function findUser(store, username) {
  const key = String(username || '').trim().toLowerCase();
  return store.users.find((user) => user.username.toLowerCase() === key) || null;
}

/** 仍然可用的管理员数量(禁用的不算)——用于「别把自己锁在门外」的几条约束 */
function activeAdminCount(store) {
  return store.users.filter((user) => user.role === 'admin' && !user.disabled).length;
}

function publicUser(user) {
  return {
    username: user.username,
    role: user.role,
    disabled: Boolean(user.disabled),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null
  };
}

// ---------------------------------------------------------------------------
// 初始化
// ---------------------------------------------------------------------------

/**
 * 首次启动:没有任何账号时自动建 admin,口令随机生成且【只打印一次】。
 * 刻意不留 admin/admin123 这类可猜默认口令 —— 这个面板能执行 shell 命令。
 */
export async function bootstrap(config) {
  const store = readStore(config);
  if (store.users.length > 0) return null;

  const password = generatePassword();
  const salt = crypto.randomBytes(16).toString('hex');
  store.users.push({
    username: 'admin',
    role: 'admin',
    salt,
    hash: hashPassword(password, salt),
    disabled: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  });
  await writeStore(config, store);

  const line = '='.repeat(66);
  console.log(`\n${line}`);
  console.log('  [首次初始化] 已创建管理员账号');
  console.log('    用户名: admin');
  console.log(`    密码  : ${password}`);
  console.log('  请立即登录并修改密码,此密码不会再次显示。');
  console.log(`${line}\n`);
  return { username: 'admin', password };
}

// ---------------------------------------------------------------------------
// 登录 / 会话
// ---------------------------------------------------------------------------

function failureKey(username, ip) {
  return `${String(username || '').toLowerCase()}@${ip || '-'}`;
}

/** 剩余锁定毫秒数,0 表示未锁定 */
function lockoutRemaining(username, ip) {
  const entry = loginFailures.get(failureKey(username, ip));
  if (!entry || entry.count < MAX_LOGIN_FAILURES) return 0;
  const remaining = entry.until - Date.now();
  if (remaining <= 0) {
    loginFailures.delete(failureKey(username, ip));
    return 0;
  }
  return remaining;
}

function recordFailure(username, ip) {
  const key = failureKey(username, ip);
  const entry = loginFailures.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= MAX_LOGIN_FAILURES) entry.until = Date.now() + LOCKOUT_MS;
  loginFailures.set(key, entry);
}

/**
 * 校验账号口令。返回 { ok, user?, error? }。
 * 用户名不存在与口令错误【返回同一条提示】,避免枚举出哪些账号真实存在。
 */
export async function verifyLogin(config, username, password, ip) {
  const locked = lockoutRemaining(username, ip);
  if (locked > 0) {
    return { ok: false, error: `失败次数过多,请在 ${Math.ceil(locked / 1000)} 秒后重试` };
  }

  const store = readStore(config);
  const user = findUser(store, username);
  const generic = { ok: false, error: '用户名或密码错误' };

  if (!user || !verifyPassword(String(password || ''), user.salt, user.hash)) {
    recordFailure(username, ip);
    return generic;
  }
  if (user.disabled) {
    // 口令虽对但账号被禁用 —— 这里可以明确提示,不涉及枚举风险
    return { ok: false, error: '该账号已被禁用,请联系管理员' };
  }

  loginFailures.delete(failureKey(username, ip));
  user.lastLoginAt = new Date().toISOString();
  await writeStore(config, store);
  return { ok: true, user: publicUser(user) };
}

export function createSession(user, ip) {
  const sid = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(sid, {
    username: user.username,
    role: user.role,
    ip: ip || '',
    csrf: crypto.randomBytes(24).toString('hex'),
    createdAt: now,
    lastSeenAt: now
  });
  return sid;
}

/**
 * 取会话并顺带续期。角色以 users.json 为准实时回读 ——
 * 这样管理员改了别人的角色/禁用了账号,对方【当前这个会话立刻生效】,不必等重新登录。
 */
export function getSession(config, sid) {
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;

  if (Date.now() - session.lastSeenAt > SESSION_IDLE_MS) {
    sessions.delete(sid);
    return null;
  }

  const user = findUser(readStore(config), session.username);
  if (!user || user.disabled) {
    sessions.delete(sid);
    return null;
  }

  session.role = user.role;
  session.lastSeenAt = Date.now();
  return session;
}

export function destroySession(sid) {
  if (sid) sessions.delete(sid);
}

/** 某个用户名的全部会话作废(改密码、禁用、删除时调用) */
function dropSessionsOf(username) {
  const key = String(username || '').toLowerCase();
  for (const [sid, session] of sessions) {
    if (session.username.toLowerCase() === key) sessions.delete(sid);
  }
}

// ---------------------------------------------------------------------------
// 权限
// ---------------------------------------------------------------------------

export function can(user, permission) {
  if (!user) return false;
  return (ROLE_PERMISSIONS[user.role] || []).includes(permission);
}

// ---------------------------------------------------------------------------
// Cookie
// ---------------------------------------------------------------------------

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function sessionCookie(sid) {
  // 生产若挂 HTTPS,应在此串尾再加 "; Secure"。
  // 当前默认 host=127.0.0.1 走明文 HTTP,加 Secure 反而会让 cookie 不被发送。
  return `${SESSION_COOKIE}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_IDLE_MS / 1000)}`;
}

export function clearCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

export function cookieName() {
  return SESSION_COOKIE;
}

// ---------------------------------------------------------------------------
// 账号管理(全部只允许 admin 调用,权限由路由层把关)
// ---------------------------------------------------------------------------

export function listUsers(config) {
  return readStore(config).users
    .map(publicUser)
    .sort((a, b) => a.username.localeCompare(b.username));
}

function validateUsername(username) {
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return '用户名需为 3-32 位字母、数字、下划线、点或连字符';
  }
  return null;
}

function validatePassword(password) {
  if (String(password || '').length < 8) return '密码至少 8 位';
  return null;
}

export async function createUser(config, { username, password, role }) {
  const name = String(username || '').trim();
  const nameError = validateUsername(name);
  if (nameError) return { ok: false, error: nameError };
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  if (!ROLES.includes(role)) return { ok: false, error: '角色不合法' };

  const store = readStore(config);
  if (findUser(store, name)) return { ok: false, error: `用户名 ${name} 已存在` };

  const salt = crypto.randomBytes(16).toString('hex');
  store.users.push({
    username: name,
    role,
    salt,
    hash: hashPassword(password, salt),
    disabled: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  });
  await writeStore(config, store);
  return { ok: true, message: `已创建账号 ${name}(${ROLE_LABELS[role]})` };
}

export async function setRole(config, username, role) {
  if (!ROLES.includes(role)) return { ok: false, error: '角色不合法' };
  const store = readStore(config);
  const user = findUser(store, username);
  if (!user) return { ok: false, error: '账号不存在' };
  if (user.role === role) return { ok: true, message: `${user.username} 角色未变` };
  // 防自锁:不能把最后一个可用管理员降级
  if (user.role === 'admin' && role !== 'admin' && activeAdminCount(store) <= 1) {
    return { ok: false, error: '这是最后一个可用管理员,不能降级' };
  }
  user.role = role;
  await writeStore(config, store);
  return { ok: true, message: `${user.username} 角色已改为 ${ROLE_LABELS[role]}` };
}

export async function setPassword(config, username, password) {
  const passwordError = validatePassword(password);
  if (passwordError) return { ok: false, error: passwordError };
  const store = readStore(config);
  const user = findUser(store, username);
  if (!user) return { ok: false, error: '账号不存在' };

  user.salt = crypto.randomBytes(16).toString('hex');
  user.hash = hashPassword(password, user.salt);
  await writeStore(config, store);
  // 改密后强制该用户重新登录(可能正是因为口令泄露才改的)
  dropSessionsOf(user.username);
  return { ok: true, message: `${user.username} 的密码已重置,其已登录会话已失效` };
}

export async function setDisabled(config, username, disabled) {
  const store = readStore(config);
  const user = findUser(store, username);
  if (!user) return { ok: false, error: '账号不存在' };
  // 防自锁:不能禁用最后一个可用管理员
  if (disabled && user.role === 'admin' && activeAdminCount(store) <= 1) {
    return { ok: false, error: '这是最后一个可用管理员,不能禁用' };
  }
  user.disabled = Boolean(disabled);
  await writeStore(config, store);
  if (user.disabled) dropSessionsOf(user.username);
  return { ok: true, message: `${user.username} 已${user.disabled ? '禁用' : '启用'}` };
}

export async function deleteUser(config, username, currentUsername) {
  const store = readStore(config);
  const user = findUser(store, username);
  if (!user) return { ok: false, error: '账号不存在' };
  // 防自锁:不能删自己,也不能删最后一个可用管理员
  if (user.username.toLowerCase() === String(currentUsername || '').toLowerCase()) {
    return { ok: false, error: '不能删除当前登录的账号' };
  }
  if (user.role === 'admin' && activeAdminCount(store) <= 1) {
    return { ok: false, error: '这是最后一个可用管理员,不能删除' };
  }
  store.users = store.users.filter((item) => item !== user);
  await writeStore(config, store);
  dropSessionsOf(user.username);
  return { ok: true, message: `已删除账号 ${user.username}` };
}
