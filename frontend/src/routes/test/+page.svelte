<script>
  console.log('Test page script executing...');
  
  let message = 'JavaScript is working!';
  
  function handleClick() {
    message = 'Button clicked!';
    console.log('Button was clicked');
  }
</script>

<h1>Test Page - Simple</h1>
<p>{message}</p>
<button onclick={handleClick}>Click me</button>
<p>If you see this AND button works, JS is fine.</p>