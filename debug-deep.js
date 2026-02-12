import { chromium } from 'playwright';

async function deepDebug() {
  console.log('🔍 DEEP DEBUG - Tracking JavaScript errors and console logs');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Track ALL console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    const location = msg.location();
    console.log(`🌐 [${type.toUpperCase()}] ${text}`);
    if (location.url) {
      console.log(`   📍 at ${location.url}:${location.lineNumber}:${location.columnNumber}`);
    }
  });
  
  // Track JavaScript errors
  page.on('pageerror', error => {
    console.log(`💥 PAGE ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  });
  
  // Track failed requests
  page.on('requestfailed', request => {
    console.log(`❌ FAILED REQUEST: ${request.url()}`);
    console.log(`   Method: ${request.method()}`);
    console.log(`   Error: ${request.failure()?.errorText || 'Unknown'}`);
  });
  
  // Track response errors
  page.on('response', response => {
    if (!response.ok()) {
      console.log(`⚠️ ERROR RESPONSE: ${response.status()} ${response.url()}`);
    }
  });
  
  try {
    console.log('🔄 Loading page with full monitoring...');
    await page.goto('http://192.168.0.253:8080', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for SvelteKit to potentially hydrate
    console.log('⏳ Waiting 5s for hydration...');
    await page.waitForTimeout(5000);
    
    // Check for specific elements that should exist
    console.log('🔍 Checking for specific elements...');
    
    const hasSpinner = await page.locator('.animate-spin').isVisible().catch(() => false);
    console.log(`⏳ Spinner visible: ${hasSpinner}`);
    
    const hasLoginForm = await page.locator('form').isVisible().catch(() => false);
    console.log(`📝 Login form visible: ${hasLoginForm}`);
    
    const hasError = await page.locator('.error, [class*="error"]').isVisible().catch(() => false);
    console.log(`❌ Error message visible: ${hasError}`);
    
    // Check the HTML structure
    const bodyHTML = await page.locator('body').innerHTML();
    console.log(`📄 Body HTML length: ${bodyHTML.length} chars`);
    console.log(`📄 Body preview: ${bodyHTML.substring(0, 500)}...`);
    
    // Look for SvelteKit specific elements
    const hasSvelteData = bodyHTML.includes('__sveltekit');
    console.log(`🔧 SvelteKit data present: ${hasSvelteData}`);
    
    // Execute JavaScript to check store states
    const storeState = await page.evaluate(() => {
      try {
        // Try to access any globals that might be set
        return {
          hasWindow: typeof window !== 'undefined',
          hasSvelteKit: typeof window.__sveltekit !== 'undefined',
          userAgent: navigator.userAgent,
          windowErrors: window.onerror ? 'error handler set' : 'no error handler'
        };
      } catch (e) {
        return { error: e.message };
      }
    });
    
    console.log('🔧 JavaScript environment:', JSON.stringify(storeState, null, 2));
    
    // Take final screenshot
    console.log('📸 Taking final debug screenshot...');
    await page.screenshot({ path: '/root/clawd/debug-deep-final.png' });
    
    // Wait longer to see if anything changes
    console.log('⏳ Waiting 10 more seconds to see if anything resolves...');
    await page.waitForTimeout(10000);
    
    // Final check
    const finalSpinner = await page.locator('.animate-spin').isVisible().catch(() => false);
    console.log(`⏳ Spinner still visible after 15s total: ${finalSpinner}`);
    
    await page.screenshot({ path: '/root/clawd/debug-deep-15s.png' });
    
  } catch (error) {
    console.error('💥 Debug error:', error);
    await page.screenshot({ path: '/root/clawd/debug-deep-error.png' });
  } finally {
    await browser.close();
    console.log('🏁 Deep debug complete');
  }
}

deepDebug().catch(console.error);