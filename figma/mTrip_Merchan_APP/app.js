const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const logo = 'https://www.figma.com/api/mcp/asset/ff20e3fb-aa7d-40be-8cc6-056cdea27330.png';
const qrCode = 'https://www.figma.com/api/mcp/asset/6ea91d19-75ea-4892-883e-4d26cbb13c88.png';
let toastTimer;

function status() { return '<div class="status"><strong>9:41</strong><div class="status-icons"><span class="signal"><i></i><i></i><i></i><i></i></span><span class="wifi"></span><span class="battery"><span></span></span></div></div>'; }
function showToast(message) { toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800); }
function onboarding() {
  app.innerHTML = `${'<section class="teal-screen">'}${status()}<header class="hero"><img class="logo" src="${logo}" alt="MyanmarTrip"><h1>Become Our Partner</h1><p>Join Myanmar's premier travel network. Manage your property, reach more guests, and grow your revenue seamlessly.</p></header><section class="surface"><div class="features"><article class="feature"><div class="feature-icon green">↗</div><div><h2>Increase your bookings</h2><p>Reach millions of travelers daily.</p></div></article><article class="feature"><div class="feature-icon aqua">▯</div><div><h2>Easy mobile management</h2><p>Control everything from your phone.</p></div></article><article class="feature"><div class="feature-icon amber">◉</div><div><h2>24/7 Merchant support</h2><p>We are always here to help you.</p></div></article></div><footer class="actions"><button class="primary" id="register">Register Now</button><p>Already a partner? <button class="link" id="login">Log In</button></p></footer></section></section>`;
  document.querySelector('#register').onclick = () => showToast('Registration flow coming next');
  document.querySelector('#login').onclick = login;
}
function login() {
  app.innerHTML = `${'<section class="teal-screen">'}${status()}<nav class="nav"><button class="back" id="back"><span class="back-icon">‹</span><span>Back</span></button></nav><header class="login-header"><img class="logo" src="${logo}" alt="MyanmarTrip"><h1>Merchant Login</h1><p>Access your dashboard using your assigned<br>Merchant Access Code.</p></header><section class="login-surface"><input class="field" id="access-code" placeholder="MTRP - XXXX" aria-label="Merchant Access Code"><div class="login-actions"><button class="primary" id="dashboard">Login to Dashboard</button><div class="divider">OR CONTINUE WITH</div><button class="outline" id="qr-login"><span class="qr-symbol">⌘</span> Login via QR Code</button></div></section></section>`;
  document.querySelector('#back').onclick = onboarding;
  document.querySelector('#dashboard').onclick = () => showToast('Enter your merchant access code');
  document.querySelector('#qr-login').onclick = setupModal;
}
function setupModal() {
  app.innerHTML = `${'<section class="flow-screen" style="background:#e7ecee;">'}${status()}<div class="modal"><div class="modal-icon">♢</div><h2>Step 1: Get the Authenticator App</h2><p>To secure your account, you will need an authenticator app like Google Authenticator. Please download it on your phone before proceeding to the next step.</p><div class="stores"><button class="store">● &nbsp; DOWNLOAD ON THE<br><strong>App Store</strong></button><button class="store">▶ &nbsp; GET IT ON<br><strong>Google Play</strong></button></div><hr><button class="outline" id="next">I already have the app - Next Step →</button></div></section>`;
  document.querySelector('#next').onclick = qrStep;
}
function qrStep() {
  app.innerHTML = `<section class="flow-screen"><div class="flow-content">${status()}<div class="flow-nav"><nav class="nav"><button class="back" id="back"><span class="back-icon">‹</span><span>Back</span></button><strong style="color:var(--teal)">Step 2/3</strong></nav><div class="progress"><span></span></div></div><h1 class="flow-title">Link Authenticator</h1><p class="flow-description">Step 2: Scan this QR code with your Google Authenticator app to link your account.</p><img class="qr" src="${qrCode}" alt="Authenticator QR code"><p class="manual-label">Can't scan? Use the Manual Setup Key</p><button class="manual"><span>JBSW Y3DP EHPK 3PXP</span><span class="copy" id="copy">▣ Copy</span></button></div><footer class="flow-footer"><button class="primary" id="scanned">I have scanned the QR code</button></footer></section>`;
  document.querySelector('#back').onclick = setupModal;
  document.querySelector('#copy').onclick = () => { navigator.clipboard?.writeText('JBSW Y3DP EHPK 3PXP'); showToast('✓ Copied'); };
  document.querySelector('#scanned').onclick = () => showToast('Verification step coming next');
}
onboarding();
