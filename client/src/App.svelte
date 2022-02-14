<script>
  import { throttle } from "lodash";
  import { onMount } from "svelte";

  import SlotList from "./SlotList.svelte";

  const drawWindowThrottleTime = 100;

  let canvas;
  let window;
  let showJson = false;
  let showItemList = true;

  let windowsCoordinates;

  // Draw window reactively when `window` changes
  $: drawWindow(window);

  const drawWindow = throttle(async (window) => {
    if (!window) return;

    const ctx = canvas.getContext("2d");

    // Draw background
    await new Promise((resolve) => {
      const windowImage = new Image();
      windowImage.addEventListener("load", function () {
        canvas.width = windowImage.width;
        canvas.height = windowImage.height;
        ctx.drawImage(windowImage, 0, 0);

        resolve();
      });
      windowImage.src = `windows/${window?.type ?? "inventory"}.png`;
    });

    // Draw items
    for (const item in window.slots) {
      if (!window.slots[item]) continue;
      const inventorySlot =
        windowsCoordinates[window.type][window.slots[item].slot];

      if (window.slots[item].texture && inventorySlot) {
        const itemImage = new Image();
        itemImage.src = window.slots[item].texture;

        itemImage.onload = function () {
          // Draw item image
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(itemImage, inventorySlot[0], inventorySlot[1], 32, 32);

          // Draw item count
          if (window.slots[item].count > 1) {
            ctx.font = "20px monospace";
            ctx.fillStyle = "black";
            ctx.textAlign = "end";
            ctx.fillText(
              window.slots[item].count,
              inventorySlot[0] + 33,
              inventorySlot[1] + 31
            );
            ctx.fillStyle = "white";
            ctx.fillText(
              window.slots[item].count,
              inventorySlot[0] + 32,
              inventorySlot[1] + 30
            );
          }
        };
      }
    }
  }, drawWindowThrottleTime);

  onMount(async () => {
    // Fetch Windows Coordinates
    windowsCoordinates = await (
      await fetch("/windows/coordinates.json")
    ).json();

    const socket = io();

    socket.on("window", function (_window) {
      window = _window;
    });

    socket.on("windowUpdate", function (_windowUpdate) {
      // Ignore updates that are not from the current window
      if (_windowUpdate.id !== window.id) return;

      for (const slot in _windowUpdate.slots) {
        window.slots[slot] = _windowUpdate.slots[slot];
      }
    });

    // onDestroy
    return () => {
      socket.disconnect();
    };
  });
</script>

<main>
  <!-- Canvas -->
  <canvas bind:this={canvas} id="windowCanvas" width="352" height="332">
    <span
      >Upgrade your browser and/or activate JavaScript to see the graphical
      inventory</span
    >
  </canvas>

  <!-- Buttons -->
  <button
    on:click={() => {
      showJson = !showJson;
    }}
  >
    {showJson ? "Hide JSON" : "Show JSON"}
  </button>

  <button
    on:click={() => {
      showItemList = !showItemList;
    }}
  >
    {showItemList ? "Hide Item List" : "Show Item List"}
  </button>

  <!-- Lists -->
  {#if showJson && window}
    <pre>{JSON.stringify(window, null, 4)}</pre>
  {/if}

  {#if showItemList && window}
    <SlotList
      slots={Object.values(window.slots)}
      emptyMessage={"The window is empty"}
    />
  {/if}
</main>

<style>
  * {
    font-family: monospace;
  }

  pre {
    font-family: monospace;
  }
</style>
