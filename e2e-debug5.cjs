const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then(c => c.newPage());

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // Login via store
  await page.goto('http://192.168.0.253:5173/auth/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin@test.com');
  await page.fill('input[type="password"]', 'test');
  await page.click('button:has-text("Iniciar Sesión")');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Navigate and inject test
  await page.click('a[href="/dashboard/properties"]');
  await page.waitForTimeout(2000);
  
  // Check if page has an error boundary or something
  const html = await page.content();
  if (html.includes('error') || html.includes('Error')) {
    console.log('Found error-like text in HTML');
  }
  
  // Try to call fetchAll from the browser console
  const result = await page.evaluate(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/properties?page=1&limit=12', {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      return { ok: true, count: data.data?.length, total: data.pagination?.total };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Manual API test:', JSON.stringify(result));
  
  // Check what the store state looks like
  await page.waitForTimeout(1000);
  const mainText = await page.textContent('main');
  console.log('Properties count in UI:', mainText?.match(/\d+ propiedades/)?.[0] || 'not found');
  
  await browser.close();
})();
