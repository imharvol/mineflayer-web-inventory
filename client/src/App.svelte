<script lang="ts">
import type { WindowMessage } from '@shared/messages'
import { onMount } from 'svelte'
import SlotList from './components/SlotList.svelte'
import WindowCanvas from './components/WindowCanvas.svelte'
import { type Coordinates, loadCoordinates } from './lib/coordinates'
import { connect } from './lib/socket'
import { applyUpdate, applyWindow } from './lib/windowState'

let botWindow = $state<WindowMessage>()
let coordinates = $state<Coordinates>()
let showJson = $state(false)
let showItemList = $state(true)

const slots = $derived(botWindow ? Object.values(botWindow.slots) : [])

function downloadPng(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas#windowCanvas')
  canvas?.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${botWindow?.type ?? 'window'}.png`
    link.href = url
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  })
}

onMount(() => {
  const socket = connect()

  socket.on('window', (message) => {
    botWindow = applyWindow(botWindow, message)
  })
  socket.on('windowUpdate', (update) => {
    if (!botWindow) return
    botWindow = applyUpdate(botWindow, update)
  })

  // The canvas stays blank if coordinates cannot be fetched; the rest of the UI works.
  void loadCoordinates().then((loaded) => {
    coordinates = loaded
  })

  return () => {
    socket.disconnect()
  }
})
</script>

<svelte:head>
  <title>mineflayer bot's inventory</title>
</svelte:head>

<main>
  <WindowCanvas {botWindow} {coordinates} />

  {#if botWindow}
    {#if botWindow.unsupported}
      <p style="color: #FF5555;">
        The current window is not supported but mineflayer-web-inventory will still try to show you
        inventory updates
      </p>
    {/if}
    <div class="window-info">
      <p>Current Window Id: {botWindow.realId ?? botWindow.id}</p>
      <p>Current Window Type: {botWindow.realType ?? botWindow.type}</p>
    </div>
  {/if}

  <div class="button-group">
    <button
      onclick={() => {
        showJson = !showJson
      }}
    >
      {showJson ? 'Hide JSON' : 'Show JSON'}
    </button>

    <button
      onclick={() => {
        showItemList = !showItemList
      }}
    >
      {showItemList ? 'Hide Item List' : 'Show Item List'}
    </button>

    <button onclick={downloadPng}>Download PNG</button>
  </div>

  {#if showJson && botWindow}
    <pre>{JSON.stringify(botWindow, null, 4)}</pre>
  {/if}

  {#if showItemList && botWindow}
    <SlotList {slots} emptyMessage={'The window is empty'} />
  {/if}
</main>

<style>
  .window-info {
    background-color: #373737;
    padding: 8px 16px;
    border-radius: 4px;
    margin: 8px 0;
    border: 2px solid #727272;
  }

  pre {
    max-height: 300px;
    overflow-y: auto;
  }
</style>
