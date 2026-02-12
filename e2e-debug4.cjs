const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then(c => c.newPage());

  page.on('request', req => {
    if (req.url().includes('/api/')) console.log(`>> ${req.method()} ${req.url()}`);
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) console.log(`<< ${res.status()} ${res.url()}`);
  });
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // Login
  await page.goto('http://192.168.0.253:5173/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'test');
  await page.click('button:has-text("Iniciar Sesión")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('=== On dashboard, waiting 2s ===');
  await page.waitForTimeout(2000);
  
  console.log('=== Clicking properties ===');
  await page.click('a[href="/dashboard/properties"]');
  await page.waitForTimeout(5000);
  
  console.log('=== Done waiting ===');
  console.log('URL:', page.url());
  
  await browser.close();
})();
