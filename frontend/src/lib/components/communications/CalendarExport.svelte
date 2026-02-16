<script lang="ts">
  import { getCalendarFeedUrl } from '$lib/stores/communications'

  let feedUrl = ''
  let instructions: Record<string, string> = {}
  let loading = false
  let copied = false

  async function generateFeedUrl() {
    loading = true
    const result = await getCalendarFeedUrl()
    if (result) {
      feedUrl = result.feedUrl
      instructions = result.instructions
    }
    loading = false
  }

  function copyUrl() {
    navigator.clipboard.writeText(feedUrl)
    copied = true
    setTimeout(() => copied = false, 2000)
  }
</script>

<div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
  <h3 class="text-lg font-semibold flex items-center gap-2 mb-3">
    <span class="text-2xl">📅</span>
    Sincronizar Calendario
  </h3>
  
  <p class="text-sm text-gray-600 mb-4">
    Suscríbete desde tu móvil para ver tus citas en el calendario nativo.
  </p>

  {#if feedUrl}
    <div class="space-y-3">
      <div class="flex gap-2">
        <input value={feedUrl} readonly
          class="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono truncate" />
        <button on:click={copyUrl}
          class="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 flex-shrink-0">
          {copied ? '✅' : '📋'}
        </button>
      </div>

      <div class="space-y-2">
        {#each Object.entries(instructions) as [platform, instruction]}
          <details class="text-sm">
            <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              {platform === 'ios' ? '🍎 iPhone/iPad' : platform === 'android' ? '🤖 Android' : '💻 Outlook'}
            </summary>
            <p class="mt-1 text-gray-500 pl-4 text-xs">{instruction}</p>
          </details>
        {/each}
      </div>
    </div>
  {:else}
    <button on:click={generateFeedUrl} disabled={loading}
      class="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 
             disabled:opacity-50 font-medium transition-colors">
      {loading ? '⏳ Generando...' : '🔗 Obtener URL de suscripción'}
    </button>
  {/if}
</div>
