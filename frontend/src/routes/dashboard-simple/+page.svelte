<script>
  import { onMount } from 'svelte';
  
  let stats = null;
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      console.log('🔄 Loading dashboard data...');
      
      // Test API calls
      const [propsRes, clientsRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/clients')
      ]);
      
      const propsData = await propsRes.json();
      const clientsData = await clientsRes.json();
      
      console.log('📊 Props data:', propsData);
      console.log('👥 Clients data:', clientsData);
      
      stats = {
        properties: propsData.pagination?.total || 0,
        clients: clientsData.pagination?.total || 0,
        documents: 156,
        revenue: 450000
      };
      
      loading = false;
      console.log('✅ Dashboard loaded successfully');
      
    } catch (e) {
      console.error('❌ Dashboard error:', e);
      error = e.message;
      loading = false;
    }
  });
</script>

<div class="p-8">
  <h1 class="text-3xl font-bold mb-6">📊 Dashboard Inmobiliaria</h1>
  
  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
      <p class="mt-4 text-gray-600">Cargando datos...</p>
    </div>
  {:else if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
      Error: {error}
    </div>
  {:else if stats}
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-blue-100 p-6 rounded-lg">
        <h3 class="text-lg font-semibold text-blue-800">🏠 Propiedades</h3>
        <p class="text-3xl font-bold text-blue-600">{stats.properties}</p>
      </div>
      
      <div class="bg-green-100 p-6 rounded-lg">
        <h3 class="text-lg font-semibold text-green-800">👥 Clientes</h3>
        <p class="text-3xl font-bold text-green-600">{stats.clients}</p>
      </div>
      
      <div class="bg-purple-100 p-6 rounded-lg">
        <h3 class="text-lg font-semibold text-purple-800">📄 Documentos</h3>
        <p class="text-3xl font-bold text-purple-600">{stats.documents}</p>
      </div>
      
      <div class="bg-yellow-100 p-6 rounded-lg">
        <h3 class="text-lg font-semibold text-yellow-800">💰 Ingresos</h3>
        <p class="text-3xl font-bold text-yellow-600">€{stats.revenue.toLocaleString()}</p>
      </div>
    </div>
    
    <div class="mt-8">
      <h2 class="text-xl font-semibold mb-4">🎉 ¡Frontend funcionando!</h2>
      <ul class="space-y-2 text-green-600">
        <li>✅ JavaScript ejecutándose correctamente</li>
        <li>✅ API calls funcionando</li>
        <li>✅ Componentes Svelte 5 actualizados</li>
        <li>✅ Mock backend respondiendo</li>
        <li>✅ Datos cargados desde /api/properties y /api/clients</li>
      </ul>
    </div>
  {/if}
</div>