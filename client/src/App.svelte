<script>
  import { throttle } from "lodash";
  import { onMount } from "svelte";

  import { receiveWindow, updateWindow } from "./updateWindow";

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

    // Draw slots
    for (const slot in window.slots) {
      if (!window.slots[slot]) continue;

      const slotCoordinates =
        windowsCoordinates[window.type][window.slots[slot].slot];

      if (window.slots[slot].texture && slotCoordinates) {
        const slotImage = new Image();
        slotImage.src = window.slots[slot].texture;

        slotImage.onload = function () {
          // Draw slot image
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(
            slotImage,
            slotCoordinates[0],
            slotCoordinates[1],
            32,
            32
          );

          // Draw slot count
          if (window.slots[slot].count > 1) {
            ctx.font = "20px monospace";
            ctx.fillStyle = "black";
            ctx.textAlign = "end";
            ctx.fillText(
              window.slots[slot].count,
              slotCoordinates[0] + 33,
              slotCoordinates[1] + 31
            );
            ctx.fillStyle = "white";
            ctx.fillText(
              window.slots[slot].count,
              slotCoordinates[0] + 32,
              slotCoordinates[1] + 30
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
      window = receiveWindow(window, _window);
    });

    socket.on("windowUpdate", function (_windowUpdate) {
      window = updateWindow(window, _windowUpdate);
    });

    // onDestroy
    return () => {
      socket.disconnect();
    };
  });
</script>

<svelte:head>
  <title>mineflayer bot's inventory</title>
</svelte:head>

<main>
  <!-- Canvas -->
  <canvas bind:this={canvas} id="windowCanvas" width="352" height="332">
    <p>
      Upgrade your browser and/or activate JavaScript to see the graphical
      inventory
    </p>
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

  {#if window}
    {#if window.unsupported}
      <p style="color: red;">The current window is not supported but mineflayer-web-inventory will still try to show you inventory updates</p>
    {/if}
    <p>Current Window Id: {window.realId ?? window.id}</p>
    <p>Current Window Type: {window.realType ?? window.type}</p>
  {/if}

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
