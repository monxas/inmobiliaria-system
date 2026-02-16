<script lang="ts">
  import WhatsAppPanel from '$lib/components/communications/WhatsAppPanel.svelte'
  import CommunicationHub from '$lib/components/communications/CommunicationHub.svelte'
  import PushNotificationToggle from '$lib/components/communications/PushNotificationToggle.svelte'
  import CalendarExport from '$lib/components/communications/CalendarExport.svelte'

  let activeTab: 'hub' | 'settings' = 'hub'
</script>

<svelte:head>
  <title>Comunicaciones | Inmobiliaria</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-4 sm:py-6">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-xl sm:text-2xl font-bold text-gray-900">📡 Comunicaciones</h1>
    <div class="flex bg-gray-100 rounded-lg p-0.5">
      <button
        on:click={() => activeTab = 'hub'}
        class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          {activeTab === 'hub' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">
        Mensajes
      </button>
      <button
        on:click={() => activeTab = 'settings'}
        class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors
          {activeTab === 'settings' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}">
        Config
      </button>
    </div>
  </div>

  {#if activeTab === 'hub'}
    <CommunicationHub />
  {:else}
    <div class="space-y-4">
      <WhatsAppPanel />
      <PushNotificationToggle />
      <CalendarExport />

      <!-- Message Templates Info -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 class="text-lg font-semibold flex items-center gap-2 mb-3">
          <span class="text-2xl">📝</span>
          Plantillas de Mensaje
        </h3>
        <p class="text-sm text-gray-600 mb-3">
          Los mensajes automáticos usan plantillas personalizables:
        </p>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm">
            <span class="text-green-500">✅</span>
            <span class="text-gray-700">Confirmación de visita (WhatsApp)</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-blue-500">⏰</span>
            <span class="text-gray-700">Recordatorio 24h antes</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-blue-500">⏰</span>
            <span class="text-gray-700">Recordatorio 1h antes</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-purple-500">👋</span>
            <span class="text-gray-700">Follow-up post-visita (día siguiente)</span>
          </div>
          <div class="flex items-center gap-2 text-sm">
            <span class="text-orange-500">📱</span>
            <span class="text-gray-700">SMS de respaldo si WhatsApp falla</span>
          </div>
        </div>
        <a href="/dashboard/settings" class="inline-block mt-3 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Editar plantillas →
        </a>
      </div>

      <!-- Flow Explanation -->
      <div class="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 sm:p-6 border border-green-100">
        <h3 class="font-semibold text-gray-900 mb-2">🔄 Flujo Automático</h3>
        <div class="space-y-2 text-sm text-gray-700">
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0 mt-0.5">1</span>
            <span>Creas un evento en el calendario con cliente asignado</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0 mt-0.5">2</span>
            <span>📲 WhatsApp envía confirmación automática al cliente</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0 mt-0.5">3</span>
            <span>🔔 Push notification al agente</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0 mt-0.5">4</span>
            <span>⏰ Recordatorios automáticos 24h y 1h antes</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0 mt-0.5">5</span>
            <span>👋 Follow-up automático al día siguiente</span>
          </div>
          <div class="flex items-start gap-2">
            <span class="bg-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0 mt-0.5">↪</span>
            <span class="text-gray-500">Si WhatsApp falla → SMS → Email (automático)</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
