<script lang="ts">
  import { onMount } from 'svelte'
  import {
    communicationLogs,
    fetchHistory,
    sendQuickWhatsApp,
    fetchStats,
    commStats,
  } from '$lib/stores/communications'

  export let clientId: number | undefined = undefined

  let selectedChannel = 'all'
  let quickMessage = ''
  let sending = false

  onMount(async () => {
    await Promise.all([
      fetchHistory({ clientId, limit: 50 }),
      fetchStats(),
    ])
  })

  async function handleFilter(channel: string) {
    selectedChannel = channel
    await fetchHistory({ 
      clientId, 
      channel: channel === 'all' ? undefined : channel,
      limit: 50 
    })
  }

  async function handleSendQuick() {
    if (!clientId || !quickMessage.trim()) return
    sending = true
    await sendQuickWhatsApp(clientId, quickMessage)
    quickMessage = ''
    sending = false
    await fetchHistory({ clientId, limit: 50 })
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    
    if (diffMs < 60000) return 'Ahora'
    if (diffMs < 3600000) return `hace ${Math.floor(diffMs / 60000)} min`
    if (diffMs < 86400000) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  function channelIcon(channel: string): string {
    const icons: Record<string, string> = {
      whatsapp: '💬', sms: '📱', email: '📧', push: '🔔', call: '📞'
    }
    return icons[channel] || '💌'
  }

  function statusBadge(status: string): { color: string; label: string } {
    const map: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pendiente' },
      sent: { color: 'bg-blue-100 text-blue-800', label: 'Enviado' },
      delivered: { color: 'bg-green-100 text-green-800', label: 'Entregado' },
      read: { color: 'bg-green-200 text-green-900', label: 'Leído' },
      failed: { color: 'bg-red-100 text-red-800', label: 'Fallido' },
    }
    return map[status] || { color: 'bg-gray-100 text-gray-800', label: status }
  }

  $: filteredLogs = $communicationLogs
</script>

<div class="space-y-4">
  <!-- Stats Bar -->
  {#if $commStats}
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-green-50 rounded-xl p-3 text-center">
        <div class="text-2xl font-bold text-green-700">{$commStats.last30Days.byChannel.whatsapp || 0}</div>
        <div class="text-xs text-green-600">WhatsApp (30d)</div>
      </div>
      <div class="bg-blue-50 rounded-xl p-3 text-center">
        <div class="text-2xl font-bold text-blue-700">{$commStats.last30Days.byChannel.sms || 0}</div>
        <div class="text-xs text-blue-600">SMS (30d)</div>
      </div>
      <div class="bg-purple-50 rounded-xl p-3 text-center">
        <div class="text-2xl font-bold text-purple-700">{$commStats.last30Days.byChannel.email || 0}</div>
        <div class="text-xs text-purple-600">Email (30d)</div>
      </div>
      <div class="bg-orange-50 rounded-xl p-3 text-center">
        <div class="text-2xl font-bold text-orange-700">{$commStats.last24Hours}</div>
        <div class="text-xs text-orange-600">Hoy</div>
      </div>
    </div>
  {/if}

  <!-- Channel Filter Tabs -->
  <div class="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
    {#each ['all', 'whatsapp', 'sms', 'email', 'push'] as ch}
      <button
        on:click={() => handleFilter(ch)}
        class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
          {selectedChannel === ch ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">
        {ch === 'all' ? '📋 Todo' : `${channelIcon(ch)} ${ch.charAt(0).toUpperCase() + ch.slice(1)}`}
      </button>
    {/each}
  </div>

  <!-- Quick Send (if client selected) -->
  {#if clientId}
    <div class="flex gap-2">
      <input
        bind:value={quickMessage}
        placeholder="Escribe un mensaje rápido por WhatsApp..."
        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
        on:keydown={(e) => e.key === 'Enter' && handleSendQuick()}
      />
      <button
        on:click={handleSendQuick}
        disabled={sending || !quickMessage.trim()}
        class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0">
        {sending ? '⏳' : '💬 Enviar'}
      </button>
    </div>
  {/if}

  <!-- Message Timeline -->
  <div class="space-y-2 max-h-[60vh] overflow-y-auto">
    {#each filteredLogs as log (log.id)}
      <div class="flex gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
        <div class="flex-shrink-0 text-xl mt-0.5">{channelIcon(log.channel)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            {#if log.client_name}
              <span class="font-medium text-sm text-gray-900">{log.client_name}</span>
            {/if}
            <span class="text-xs text-gray-400">{log.recipient_phone || log.recipient_email || ''}</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium {statusBadge(log.status).color}">
              {statusBadge(log.status).label}
            </span>
          </div>
          <p class="text-sm text-gray-600 mt-1 line-clamp-2">{log.message}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[10px] text-gray-400">{formatDate(log.created_at)}</span>
            <span class="text-[10px] text-gray-300 capitalize">{log.type.replace(/_/g, ' ')}</span>
          </div>
        </div>
      </div>
    {:else}
      <div class="text-center py-8 text-gray-400">
        <div class="text-3xl mb-2">📭</div>
        <p class="text-sm">Sin comunicaciones aún</p>
      </div>
    {/each}
  </div>
</div>
