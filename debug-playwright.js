import { chromium } from 'playwright';

async function debugDashboard() {
  console.log('🎭 Starting Playwright debug session...');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Listen to console messages from the browser
  page.on('console', msg => {
    console.log(`🌐 Browser Console: ${msg.text()}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`❌ Failed request: ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  try {
    console.log('🔄 Navigating to main page...');
    await page.goto('http://192.168.0.253:8080', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: '/root/clawd/debug-1-initial.png' });
    
    // Wait a bit and see what's on screen
    await page.waitForTimeout(3000);
    
    console.log('📸 Taking 3-second delay screenshot...');
    await page.screenshot({ path: '/root/clawd/debug-2-after-3s.png' });
    
    // Check if we're on login page
    const isLoginPage = await page.locator('h1:has-text("Inmobiliaria")').isVisible();
    console.log(`🔐 Is login page visible? ${isLoginPage}`);
    
    if (isLoginPage) {
      console.log('🔑 Attempting login...');
      
      // Try to fill login form
      await page.fill('input[type="email"]', 'admin@test.com');
      await page.fill('input[type="password"]', 'test123');
      
      console.log('📸 Taking filled-form screenshot...');
      await page.screenshot({ path: '/root/clawd/debug-3-login-filled.png' });
      
      // Submit form
      await page.click('button[type="submit"]');
      console.log('🚀 Login submitted, waiting for navigation...');
      
      // Wait for navigation or timeout
      await page.waitForTimeout(5000);
      
      console.log('📸 Taking post-login screenshot...');
      await page.screenshot({ path: '/root/clawd/debug-4-post-login.png' });
      
      // Check current URL
      const currentUrl = page.url();
      console.log(`📍 Current URL after login: ${currentUrl}`);
      
      // Look for dashboard elements
      const hasDashboard = await page.locator('h1:has-text("Dashboard")').isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`📊 Dashboard visible? ${hasDashboard}`);
      
      // Look for spinner
      const hasSpinner = await page.locator('.animate-spin').isVisible({ timeout: 1000 }).catch(() => false);
      console.log(`⏳ Spinner visible? ${hasSpinner}`);
      
      // Wait longer for potential content
      await page.waitForTimeout(10000);
      
      console.log('📸 Taking final screenshot after 10s wait...');
      await page.screenshot({ path: '/root/clawd/debug-5-final.png' });
      
    } else {
      console.log('🤔 Not on login page, checking what we have...');
      const pageTitle = await page.title();
      console.log(`📄 Page title: ${pageTitle}`);
      
      const bodyText = await page.locator('body').textContent();
      console.log(`📝 Page text (first 200 chars): ${bodyText?.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error('💥 Error during debug:', error);
    await page.screenshot({ path: '/root/clawd/debug-error.png' });
  } finally {
    await browser.close();
    console.log('🏁 Debug session complete');
  }
}

debugDashboard().catch(console.error);