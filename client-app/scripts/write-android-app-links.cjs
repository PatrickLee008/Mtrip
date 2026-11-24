const fs = require('node:fs');
const path = require('node:path');
const { expo } = require('../app.json');

const fingerprint = (process.env.MTRIP_ANDROID_APP_LINK_SHA256 ?? '').trim().toUpperCase();
if (!fingerprint) process.exit(0);
if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) {
  throw new Error('MTRIP_ANDROID_APP_LINK_SHA256 must be a colon-separated SHA-256 certificate fingerprint');
}

const directory = path.resolve(__dirname, '../dist/.well-known');
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(path.join(directory, 'assetlinks.json'), JSON.stringify([{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: expo.android.package,
    sha256_cert_fingerprints: [fingerprint],
  },
}], null, 2) + '\n');
