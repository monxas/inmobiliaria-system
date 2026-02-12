import { chromium } from 'playwright';

async function quickTest() {
  console.log('🚀 QUICK TEST - Checking if simple layout + no SSR fixes the spinner');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`🌐 [${msg.type()}] ${msg.text()}`));
  page.on('pageerror', error => console.log(`💥 PAGE ERROR: ${error.message}`));
  
  try {
    console.log('🔄 Loading page with console monitoring...');
    await page.goto('http://192.168.0.253:8080', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    console.log('⏳ Waiting 5 seconds and monitoring console...');
    await page.waitForTimeout(5000);
    
    // Check for spinner after 5 seconds
    const hasSpinner = await page.locator('.animate-spin').isVisible().catch(() => false);
    const hasContent = await page.locator('body').textContent();
    
    console.log(`⏳ Spinner still visible after 5s: ${hasSpinner}`);
    console.log(`📄 Page content length: ${hasContent?.length || 0} chars`);
    
    if (hasSpinner) {
      console.log('🔍 Spinner detected, waiting 10 more seconds...');
      await page.waitForTimeout(10000);
      
      const stillHasSpinner = await page.locator('.animate-spin').isVisible().catch(() => false);
      console.log(`⏳ Spinner still visible after 15s total: ${stillHasSpinner}`);
    }
    
    await page.screenshot({ path: '/root/clawd/quick-test-debug.png' });
    
  } catch (error) {
    console.error('💥 Test error:', error);
  } finally {
    await browser.close();
  }
}

quickTest().catch(console.error);