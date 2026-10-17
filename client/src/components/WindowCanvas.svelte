<script lang="ts">
import type { WindowMessage } from '@shared/messages'
import { onDestroy } from 'svelte'
import {
  type Coordinates,
  createGuardedContext,
  drawWindow,
  ITEM_SIZE,
} from '@shared/draw'
import { createCanvasContext, loadImage } from '../lib/canvas'
import { findSlotAt } from '../lib/hitTest'
import { itemLabel } from '../lib/text'
import { createThrottle } from '../lib/throttle'

interface Props {
  botWindow?: WindowMessage
  coordinates?: Coordinates
}

let { botWindow, coordinates }: Props = $props()

const DRAW_THROTTLE_MS = 100

let canvas = $state<HTMLCanvasElement>()
let pointer = $state<{ x: number; y: number } | null>(null)
let drawToken = 0

const scheduleDraw = createThrottle(() => {
  void render()
}, DRAW_THROTTLE_MS)

const hoveredSlot = $derived(
  pointer && botWindow && coordinates
    ? findSlotAt(coordinates[botWindow.type], pointer.x, pointer.y)
    : null,
)

const hoveredItem = $derived(
  botWindow && hoveredSlot !== null ? (botWindow.slots[hoveredSlot] ?? null) : null,
)

const tooltip = $derived.by(() => {
  if (!botWindow || !coordinates || hoveredSlot === null || hoveredItem === null) return null
  const position = coordinates[botWindow.type]?.[hoveredSlot]
  if (!position) return null
  const label = itemLabel(hoveredItem)
  return {
    left: position[0] + ITEM_SIZE,
    top: position[1],
    text: hoveredItem.count > 1 ? `${label} ×${hoveredItem.count}` : label,
  }
})

function handleMouseMove(event: MouseEvent): void {
  pointer = { x: event.offsetX, y: event.offsetY }
}

function handleMouseLeave(): void {
  pointer = null
}

onDestroy(() => {
  scheduleDraw.cancel()
})

$effect(() => {
  // Synchronizes with the canvas: redraw whenever the window data changes.
  if (!canvas || !botWindow || !coordinates) return
  scheduleDraw()
})

async function render(): Promise<void> {
  if (!canvas || !botWindow || !coordinates) return

  const context = createCanvasContext(canvas)
  if (!context) return

  const token = ++drawToken
  try {
    await drawWindow(
      createGuardedContext(context, () => token === drawToken),
      botWindow,
      {
        coordinates,
        loadImage,
      },
    )
  } catch {
    // A missing background image (unknown window type) just skips this paint.
  }
}
</script>

<div class="canvas-wrap">
  <canvas
    bind:this={canvas}
    id="windowCanvas"
    width="352"
    height="332"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  >
    <p>
      Upgrade your browser and/or activate JavaScript to see the graphical inventory
    </p>
  </canvas>

  {#if tooltip}
    <div
      class="slot-tooltip"
      style="left: {tooltip.left}px; top: {tooltip.top}px"
      aria-hidden="true"
    >
      {tooltip.text}
    </div>
  {/if}
</div>

<style>
  .canvas-wrap {
    position: relative;
    width: fit-content;
  }

  .slot-tooltip {
    position: absolute;
    z-index: 10;
    pointer-events: none;
    white-space: nowrap;
    padding: 4px 8px;
    border: 1px solid #2d0a63;
    border-radius: 2px;
    background-color: #100010;
    color: #fff;
    font-family: monospace;
    font-size: 14px;
  }
</style>
