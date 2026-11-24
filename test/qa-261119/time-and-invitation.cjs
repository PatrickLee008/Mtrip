const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const fromApp = Module.createRequire(path.join(root, 'client-app/package.json'));
const ts = fromApp('typescript');
let passed = 0;
function load(file, mocks = {}) {
  const item = new Module(file, module);
  item.filename = file;
  item.require = id => id in mocks ? mocks[id] : fromApp(id);
  item._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, file);
  return item.exports;
}
function check(name, call) {
  call(); passed++; console.log('PASS ' + name);
}
if (!process.argv.includes('--timezone-child')) {
  for (const zone of ['UTC', 'Asia/Shanghai', 'Asia/Yangon', 'America/New_York']) {
    const result = spawnSync(process.execPath, [__filename, '--timezone-child'], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    console.log(zone + ': ' + result.stdout.trim()); passed += 9;
  }
  let href = 'https://m.myanmartrip.com/r/mt5evab';
  global.window = { location: { get pathname() { return new URL(href).pathname; } }, history: { replaceState: (_, __, url) => { href = 'https://m.myanmartrip.com' + url; } } };
  const invite = load(path.join(root, 'client-app/src/utils/referralInvitation.ts'), {
    'react-native': { Platform: { OS: 'web' } },
    '@/config/env': { REFERRAL_LINK_BASE: 'https://m.myanmartrip.com/r/' },
  });
  check('shared link uses the active consumer host with no duplicate slash', () => assert.equal(invite.referralLink('MT5EVAB'), 'https://m.myanmartrip.com/r/MT5EVAB'));
  check('invitation accepts lowercase and optional trailing slash', () => assert.equal(invite.parseReferralInvitation('/r/mt5evab/'), 'MT5EVAB'));
  check('encoded separators cannot turn into referral data', () => assert.equal(invite.parseReferralInvitation('/r/MT5E%2FVAB'), null));
  check('native referral accepts only the configured HTTPS host', () => {
    assert.equal(invite.parseReferralInvitation('https://m.myanmartrip.com/r/mt5evab?share=1'), 'MT5EVAB');
    assert.equal(invite.parseReferralInvitation('https://other.example/r/mt5evab'), null);
    assert.equal(invite.parseReferralInvitation('https://m.myanmartrip.com@other.example/r/mt5evab'), null);
  });
  check('Google Play install URL carries one unambiguous referral', () => {
    const play = new URL(invite.referralPlayStoreUrl('MT5EVAB'));
    assert.equal(play.hostname, 'play.google.com');
    assert.equal(play.searchParams.get('id'), 'com.mtrip.clientapp');
    assert.equal(invite.referralCodeFromInstall(play.searchParams.get('referrer')), 'MT5EVAB');
    assert.equal(invite.referralCodeFromInstall('mtrip_referral=MT5EVAB&mtrip_referral=BADCODE'), null);
    assert.equal(invite.referralCodeFromInstall('utm_source=organic'), null);
  });
  check('unrelated auth callback does not become an invitation', () => assert.equal(invite.parseReferralInvitation('/auth/facebook/complete#ticket=MT5EVAB'), null));
  check('overlong and malformed codes are ignored', () => { assert.equal(invite.parseReferralInvitation('/r/' + 'A'.repeat(33)), null); assert.equal(invite.parseReferralInvitation('/r/<script>'), null); });
  check('captured invitation survives onboarding screen changes', () => { invite.captureReferralInvitation(); assert.equal(invite.getReferralInvitation(), 'MT5EVAB'); });
  check('successful authentication removes stale invitation and URL', () => { invite.clearReferralInvitation(); assert.equal(invite.getReferralInvitation(), null); assert.equal(href, 'https://m.myanmartrip.com/'); });
  check('clearing invitation never changes a social auth callback', () => { href = 'https://m.myanmartrip.com/auth/apple/complete'; invite.clearReferralInvitation(); assert.equal(href, 'https://m.myanmartrip.com/auth/apple/complete'); });
  console.log('PASS_COUNT=' + passed);
} else {
  const time = load(path.join(root, 'client-app/src/utils/time.ts'));
  const expected = Date.UTC(2026, 10, 19, 8, 10);
  assert.equal(time.parseUtcTime('2026-11-19 08:10:00'), expected);
  assert.equal(time.parseUtcTime('2026-11-19T08:10:00Z'), expected);
  assert.equal(time.parseUtcTime('2026-11-19T14:40:00+06:30'), expected);
  assert.equal(time.parseUtcTime('2026-11-19T03:10:00-05:00'), expected);
  assert.equal(time.parseUtcTime('2026-11-19 08:10:00.123456'), expected + 123);
  assert.equal(time.secondsUntilUtc('2026-11-19 08:10:00', expected - 600000), 600);
  assert.equal(time.secondsUntilUtc('2026-11-19 08:10:00', expected + 1000), 0);
  for (const invalid of ['2026-02-30 08:10:00', '2026-11-19 25:00:00', '2026-11-19junk', '2026-11-19T08:10:00+99:00']) assert.equal(time.parseUtcTime(invalid), null);
  assert.equal(time.parseUtcTime(null), null);
  console.log('9 UTC/deadline checks passed');
}
