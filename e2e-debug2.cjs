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
  
  // Wait for dashboard to fully load
  await page.waitForTimeout(3000);
  console.log('\n=== Navigating to properties ===');
  
  await page.click('a[href="/dashboard/properties"]');
  await page.waitForURL('**/properties', { timeout: 5000 });
  
  // Wait and see what happens
  await page.waitForTimeout(5000);
  
  // Check localStorage
  const token = await page.evaluate(() => localStorage.getItem('accessToken'));
  console.log('Token in localStorage:', token);
  
  // Manually try fetch from browser
  const result = await page.evaluate(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/properties?page=1&limit=12', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      return { status: res.status, body: await res.text() };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Manual fetch result:', JSON.stringify(result).substring(0, 300));
  
  await browser.close();
})();
