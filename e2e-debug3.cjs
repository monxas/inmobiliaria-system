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
  page.on('console', msg => {
    if (msg.type() !== 'debug') console.log(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // Go directly to properties page with token pre-set
  await page.goto('http://192.168.0.253:5173/auth/login', { waitUntil: 'networkidle' });
  
  // Set tokens first
  await page.evaluate(() => {
    localStorage.setItem('accessToken', 'mock-jwt-token');
    localStorage.setItem('refreshToken', 'mock-refresh-token');
  });
  
  // Now navigate to properties directly
  await page.goto('http://192.168.0.253:5173/dashboard/properties', { waitUntil: 'networkidle', timeout: 15000 });
  
  console.log('\n=== Waiting for API calls ===');
  await page.waitForTimeout(5000);
  
  const mainText = await page.textContent('main').catch(() => 'N/A');
  console.log('Main content:', mainText?.substring(0, 200));
  
  await page.screenshot({ path: '/tmp/debug-properties.png' });
  await browser.close();
})();
