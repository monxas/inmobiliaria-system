import { chromium } from 'playwright';

async function checkJSErrors() {
  console.log('🔍 FOCUSED DEBUG - Checking JavaScript module loading errors');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  // Track everything that could go wrong
  page.on('console', msg => {
    console.log(`🌐 [${msg.type()}] ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`💥 JavaScript Error: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
  });
  
  page.on('requestfailed', request => {
    console.log(`❌ Failed to load: ${request.url()}`);
    console.log(`   Error: ${request.failure()?.errorText}`);
  });
  
  // Track ALL responses, especially JS modules
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/_app/') || url.includes('.js')) {
      if (response.ok()) {
        console.log(`✅ Loaded JS: ${url} (${response.status()})`);
      } else {
        console.log(`❌ Failed JS: ${url} (${response.status()})`);
      }
    }
  });
  
  try {
    console.log('🔄 Loading with full JS monitoring...');
    
    // Navigate and wait for all resources
    await page.goto('http://192.168.0.253:8080', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Check if the main JS modules actually loaded
    console.log('\n🔍 Checking if main SvelteKit modules are accessible...');
    
    const moduleCheck = await page.evaluate(async () => {
      const results = [];
      
      try {
        // Try to manually import the same modules SvelteKit is trying to load
        results.push('Attempting manual module import...');
        
        const startModule = await import('/_app/immutable/entry/start.C8ymSzvp.js');
        results.push(`✅ start module loaded: ${typeof startModule}`);
        
        const appModule = await import('/_app/immutable/entry/app.4xLwifWu.js');
        results.push(`✅ app module loaded: ${typeof appModule}`);
        
        return results;
      } catch (error) {
        results.push(`💥 Module import error: ${error.message}`);
        results.push(`Stack: ${error.stack}`);
        return results;
      }
    });
    
    moduleCheck.forEach(result => console.log(`   ${result}`));
    
    // Also check what's in the SvelteKit global
    const globalCheck = await page.evaluate(() => {
      return {
        hasSvelteKit: !!window.__sveltekit,
        svelteKitKeys: window.__sveltekit ? Object.keys(window.__sveltekit) : 'not available',
        hasGlobal54etso: !!window.__sveltekit_54etso,
        global54etsoKeys: window.__sveltekit_54etso ? Object.keys(window.__sveltekit_54etso) : 'not available'
      };
    });
    
    console.log('\n🔧 Global state check:');
    console.log(JSON.stringify(globalCheck, null, 2));
    
    // Wait to see if anything eventually loads
    console.log('\n⏳ Waiting 10 seconds to see if SvelteKit eventually starts...');
    await page.waitForTimeout(10000);
    
    const finalCheck = await page.evaluate(() => {
      return {
        spinnerStillVisible: !!document.querySelector('.animate-spin'),
        bodyContent: document.body.textContent?.trim() || 'empty',
        hasRealContent: document.body.textContent?.length > 100,
        documentReady: document.readyState,
        svelteKitStarted: !!window.__sveltekit
      };
    });
    
    console.log('\n🏁 Final state check:');
    console.log(JSON.stringify(finalCheck, null, 2));
    
    // Take screenshot for comparison
    await page.screenshot({ path: '/root/clawd/debug-js-errors-final.png' });
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  } finally {
    await browser.close();
    console.log('\n🏁 JavaScript error debug complete');
  }
}

checkJSErrors().catch(console.error);