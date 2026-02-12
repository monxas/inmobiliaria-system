const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then(c => c.newPage());

  // Log all requests/responses
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log(`>> ${req.method()} ${req.url()}`);
      const auth = req.headers()['authorization'];
      console.log(`   Auth: ${auth || 'NONE'}`);
    }
  });
  page.on('response', res => {
    if (res.url().includes('/api/')) {
      console.log(`<< ${res.status()} ${res.url()}`);
    }
  });
  page.on('console', msg => console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`));

  // Login
  await page.goto('http://192.168.0.253:5173/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'test');
  await page.click('button:has-text("Iniciar Sesión")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  console.log('\n=== ON DASHBOARD ===');
  
  // Navigate to properties
  await page.click('a[href="/dashboard/properties"]');
  await page.waitForURL('**/properties', { timeout: 5000 });
  console.log('\n=== ON PROPERTIES ===');
  await page.waitForTimeout(3000);
  
  // Check what's in the page
  const mainText = await page.textContent('main');
  console.log('\nMain content (first 300 chars):', mainText?.substring(0, 300));
  
  await browser.close();
})();
