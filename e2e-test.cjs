const { chromium } = require('playwright');

const BASE = 'http://192.168.0.253:5173';
const results = [];
let browser, page;

function log(status, test, detail = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '🔴' : '⚠️';
  results.push({ status, test, detail });
  console.log(`${icon} ${test}${detail ? ' - ' + detail : ''}`);
}

async function run() {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Collect network failures
  const networkErrors = [];
  page.on('requestfailed', req => {
    networkErrors.push(`${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  try {
    // ============ TEST 1: Login page loads ============
    console.log('\n📋 TEST 1: Login Page');
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle', timeout: 15000 });
    
    const loginTitle = await page.textContent('h2');
    if (loginTitle?.includes('Iniciar Sesión')) {
      log('PASS', 'Login page loads', `Title: "${loginTitle}"`);
    } else {
      log('FAIL', 'Login page loads', `Got: "${loginTitle}"`);
    }

    // Check form elements
    const emailInput = await page.$('input[type="email"]');
    const passInput = await page.$('input[type="password"]');
    const submitBtn = await page.$('button');
    log(emailInput && passInput && submitBtn ? 'PASS' : 'FAIL', 'Login form elements present');

    // ============ TEST 2: Login flow ============
    console.log('\n📋 TEST 2: Login Flow');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'test');
    await page.click('button:has-text("Iniciar Sesión")');
    
    // Wait for navigation to dashboard
    try {
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      log('PASS', 'Login redirects to dashboard');
    } catch (e) {
      log('FAIL', 'Login redirects to dashboard', `Current URL: ${page.url()}`);
    }

    // ============ TEST 3: Dashboard loads ============
    console.log('\n📋 TEST 3: Dashboard');
    
    // Wait for the loading spinner to disappear and content to appear
    try {
      await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 }).catch(() => {});
      await page.waitForSelector('nav', { timeout: 10000 });
      log('PASS', 'Dashboard layout renders (sidebar visible)');
    } catch (e) {
      log('FAIL', 'Dashboard layout renders', e.message);
      // Take screenshot for debugging
      await page.screenshot({ path: '/tmp/dashboard-fail.png' });
    }

    // Check sidebar nav items
    const sidebarText = await page.textContent('aside').catch(() => '');
    const hasDashboardLink = sidebarText?.includes('Dashboard');
    const hasPropertiesLink = sidebarText?.includes('Propiedades');
    const hasClientsLink = sidebarText?.includes('Clientes');
    const hasDocumentsLink = sidebarText?.includes('Documentos');
    log(hasDashboardLink ? 'PASS' : 'FAIL', 'Sidebar: Dashboard link');
    log(hasPropertiesLink ? 'PASS' : 'FAIL', 'Sidebar: Properties link');
    log(hasClientsLink ? 'PASS' : 'FAIL', 'Sidebar: Clients link');
    log(hasDocumentsLink ? 'PASS' : 'FAIL', 'Sidebar: Documents link');

    // Check user info in sidebar/header
    const pageText = await page.textContent('body');
    const hasUserName = pageText?.includes('Admin User') || pageText?.includes('Admin');
    log(hasUserName ? 'PASS' : 'FAIL', 'User name displayed');

    await page.screenshot({ path: '/tmp/screenshot-dashboard.png', fullPage: true });

    // ============ TEST 4: Properties page ============
    console.log('\n📋 TEST 4: Properties Page');
    await page.click('a[href="/dashboard/properties"]');
    try {
      await page.waitForURL('**/dashboard/properties', { timeout: 5000 });
      log('PASS', 'Navigate to properties');
    } catch (e) {
      log('FAIL', 'Navigate to properties', page.url());
    }
    
    await page.waitForTimeout(2000);
    const propText = await page.textContent('main').catch(() => '');
    const hasPropContent = propText?.includes('Piso') || propText?.includes('Propiedades') || propText?.includes('propiedad');
    log(hasPropContent ? 'PASS' : 'FAIL', 'Properties page has content', propText?.substring(0, 100));
    await page.screenshot({ path: '/tmp/screenshot-properties.png', fullPage: true });

    // ============ TEST 5: Clients page ============
    console.log('\n📋 TEST 5: Clients Page');
    await page.click('a[href="/dashboard/clients"]');
    try {
      await page.waitForURL('**/dashboard/clients', { timeout: 5000 });
      log('PASS', 'Navigate to clients');
    } catch (e) {
      log('FAIL', 'Navigate to clients', page.url());
    }
    
    await page.waitForTimeout(2000);
    const clientText = await page.textContent('main').catch(() => '');
    const hasClientContent = clientText?.includes('Juan') || clientText?.includes('Clientes') || clientText?.includes('cliente');
    log(hasClientContent ? 'PASS' : 'FAIL', 'Clients page has content', clientText?.substring(0, 100));
    await page.screenshot({ path: '/tmp/screenshot-clients.png', fullPage: true });

    // ============ TEST 6: Documents page ============
    console.log('\n📋 TEST 6: Documents Page');
    await page.click('a[href="/dashboard/documents"]');
    try {
      await page.waitForURL('**/dashboard/documents', { timeout: 5000 });
      log('PASS', 'Navigate to documents');
    } catch (e) {
      log('FAIL', 'Navigate to documents', page.url());
    }
    
    await page.waitForTimeout(2000);
    const docText = await page.textContent('main').catch(() => '');
    const hasDocContent = docText?.includes('contrato') || docText?.includes('Documentos') || docText?.includes('documento');
    log(hasDocContent ? 'PASS' : 'FAIL', 'Documents page has content', docText?.substring(0, 100));
    await page.screenshot({ path: '/tmp/screenshot-documents.png', fullPage: true });

    // ============ TEST 7: Console & Network Errors ============
    console.log('\n📋 TEST 7: Error Analysis');
    if (consoleErrors.length === 0) {
      log('PASS', 'No console errors');
    } else {
      log('WARN', `${consoleErrors.length} console errors`, consoleErrors.slice(0, 3).join(' | '));
    }

    if (networkErrors.length === 0) {
      log('PASS', 'No network failures');
    } else {
      log('WARN', `${networkErrors.length} network failures`, networkErrors.slice(0, 3).join(' | '));
    }

    // ============ TEST 8: Logout ============
    console.log('\n📋 TEST 8: Logout');
    // Click user menu
    const userMenuBtn = await page.$('header button:last-child') || await page.$('button:has-text("Admin")');
    if (userMenuBtn) {
      await userMenuBtn.click();
      await page.waitForTimeout(500);
      const logoutBtn = await page.$('button:has-text("Cerrar Sesión")');
      if (logoutBtn) {
        await logoutBtn.click();
        try {
          await page.waitForURL('**/auth/login', { timeout: 5000 });
          log('PASS', 'Logout redirects to login');
        } catch {
          log('FAIL', 'Logout redirects to login', page.url());
        }
      } else {
        log('WARN', 'Logout button not found in menu');
      }
    } else {
      log('WARN', 'User menu button not found');
    }

  } catch (e) {
    log('FAIL', 'Unexpected error', e.message);
    await page.screenshot({ path: '/tmp/screenshot-error.png' }).catch(() => {});
  }

  // ============ SUMMARY ============
  console.log('\n' + '='.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`🔴 Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log(`Total: ${results.length}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n🔴 FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.detail}`);
    });
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => {
  console.error('Fatal error:', e);
  if (browser) browser.close();
  process.exit(1);
});
