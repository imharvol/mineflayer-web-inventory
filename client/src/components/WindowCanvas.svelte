<script lang="ts">
import type { WindowMessage } from '@shared/messages'
import { onDestroy } from 'svelte'
import {
  type Coordinates,
  createCanvasContext,
  createGuardedContext,
  drawWindow,
  loadImage,
} from '../lib/draw'
import { createThrottle } from '../lib/throttle'

interface Props {
  botWindow?: WindowMessage
  coordinates?: Coordinates
}

let { botWindow, coordinates }: Props = $props()

const DRAW_THROTTLE_MS = 100

let canvas = $state<HTMLCanvasElement>()
let drawToken = 0

const scheduleDraw = createThrottle(() => {
  void render()
}, DRAW_THROTTLE_MS)

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

<canvas bind:this={canvas} id="windowCanvas" width="352" height="332">
  <p>
    Upgrade your browser and/or activate JavaScript to see the graphical inventory
  </p>
</canvas>
