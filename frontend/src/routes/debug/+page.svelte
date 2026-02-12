<script>
  import { onMount } from 'svelte';
  
  let status = 'Loading...';
  let apiTest = 'Not tested';
  
  onMount(async () => {
    try {
      status = 'Frontend loaded ✅';
      
      // Test API
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      apiTest = `API works ✅: ${data.data?.email || 'No data'}`;
    } catch (e) {
      apiTest = `API failed ❌: ${e.message}`;
    }
  });
</script>

<h1>Debug Page</h1>
<p>Status: {status}</p>
<p>API: {apiTest}</p>
<a href="/auth/login">Go to Login</a>