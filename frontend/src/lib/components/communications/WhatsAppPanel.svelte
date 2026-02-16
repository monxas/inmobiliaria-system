<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    whatsappStatus,
    fetchWhatsAppStatus,
    initializeWhatsApp,
    disconnectWhatsApp,
    fetchWhatsAppQR,
  } from '$lib/stores/communications'

  let qrCode: string | null = null
  let pollInterval: ReturnType<typeof setInterval>

  onMount(async () => {
    await fetchWhatsAppStatus()
    // Poll status every 5 seconds while not connected
    pollInterval = setInterval(async () => {
      if (!$whatsappStatus.connected) {
        await fetchWhatsAppStatus()
        if ($whatsappStatus.state === 'qr_pending') {
          qrCode = await fetchWhatsAppQR()
        }
      }
    }, 5000)
  })

  onDestroy(() => clearInterval(pollInterval))

  async function handleInitialize() {
    await initializeWhatsApp()
  }

  async function handleDisconnect() {
    await disconnectWhatsApp()
    qrCode = null
  }
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-lg font-semibold flex items-center gap-2">
      <span class="text-2xl">💬</span>
      WhatsApp
    </h3>
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      {$whatsappStatus.connected ? 'bg-green-100 text-green-800' : 
       $whatsappStatus.state === 'connecting' ? 'bg-yellow-100 text-yellow-800' : 
       'bg-red-100 text-red-800'}">
      <span class="w-2 h-2 rounded-full
        {$whatsappStatus.connected ? 'bg-green-500' : 
         $whatsappStatus.state === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
         'bg-red-500'}"></span>
      {$whatsappStatus.connected ? 'Conectado' : 
       $whatsappStatus.state === 'connecting' ? 'Conectando...' :
       $whatsappStatus.state === 'qr_pending' ? 'Escanear QR' :
       'Desconectado'}
    </span>
  </div>

  {#if $whatsappStatus.connected}
    <div class="space-y-3">
      <p class="text-sm text-gray-600">
        📱 Número: <strong>{$whatsappStatus.phoneNumber || 'N/A'}</strong>
      </p>
      <p class="text-sm text-green-600">
        ✅ Mensajes automáticos activos
      </p>
      <button on:click={handleDisconnect}
        class="w-full sm:w-auto px-4 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">
        Desconectar
      </button>
    </div>

  {:else if $whatsappStatus.state === 'qr_pending' && qrCode}
    <div class="text-center space-y-3">
      <p class="text-sm text-gray-600">Escanea el código QR con WhatsApp:</p>
      <div class="inline-block p-3 bg-white border-2 border-gray-300 rounded-xl">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(qrCode)}" 
             alt="WhatsApp QR" class="w-48 h-48" />
      </div>
      <p class="text-xs text-gray-500">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
    </div>

  {:else}
    <div class="space-y-3">
      <p class="text-sm text-gray-600">
        Conecta WhatsApp para enviar confirmaciones automáticas de citas, recordatorios y seguimientos.
      </p>
      {#if $whatsappStatus.lastError}
        <p class="text-sm text-red-600">⚠️ {$whatsappStatus.lastError}</p>
      {/if}
      <button on:click={handleInitialize}
        class="w-full sm:w-auto px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
        🔗 Conectar WhatsApp
      </button>
    </div>
  {/if}
</div>
