<script lang="ts">
  import { onMount } from 'svelte'
  import {
    pushEnabled,
    pushSupported,
    checkPushSupport,
    subscribeToPush,
    unsubscribeFromPush,
    testPush,
  } from '$lib/stores/communications'

  let loading = false

  onMount(async () => {
    await checkPushSupport()
    // Check if already subscribed
    if ($pushSupported && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        pushEnabled.set(!!sub)
      }
    }
  })

  async function toggle() {
    loading = true
    try {
      if ($pushEnabled) {
        await unsubscribeFromPush()
      } else {
        // Request notification permission
        const permission = await Notification.requestPermission()
        if (permission === 'granted') {
          await subscribeToPush()
        }
      }
    } finally {
      loading = false
    }
  }

  async function handleTest() {
    await testPush()
  }
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
  <div class="flex items-center justify-between">
    <div>
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <span class="text-2xl">🔔</span>
        Push Notifications
      </h3>
      <p class="text-sm text-gray-500 mt-1">
        Recibe alertas de nuevas visitas y recordatorios
      </p>
    </div>

    {#if $pushSupported}
      <button
        on:click={toggle}
        disabled={loading}
        class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none
          {$pushEnabled ? 'bg-indigo-600' : 'bg-gray-200'}
          {loading ? 'opacity-50' : ''}">
        <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
          {$pushEnabled ? 'translate-x-5' : 'translate-x-0'}"></span>
      </button>
    {:else}
      <span class="text-xs text-gray-400">No soportado</span>
    {/if}
  </div>

  {#if $pushEnabled}
    <div class="mt-3 flex gap-2">
      <span class="text-sm text-green-600">✅ Notificaciones activas</span>
      <button on:click={handleTest}
        class="text-xs text-indigo-600 hover:text-indigo-800 underline">
        Enviar prueba
      </button>
    </div>
  {/if}
</div>
