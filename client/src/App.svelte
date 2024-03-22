<script>
  import { throttle } from "lodash";
  import { onMount } from "svelte";

  import { receiveWindow, updateWindow } from "./updateWindow";

  import SlotList from "./SlotList.svelte";

  const drawWindowThrottleTime = 100;

  let canvas;
  let botWindow;
  let showJson = false;
  let showItemList = true;

  let windowsCoordinates;

  // Draw window reactively when `botWindow` changes
  $: drawWindow(botWindow);

  const drawWindow = throttle(async (botWindow) => {
    if (!botWindow) return;

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
      windowImage.src = `windows/${botWindow?.type ?? "inventory"}.png`;
    });

    // Draw slots
    for (const slot in botWindow.slots) {
      if (!botWindow.slots[slot]) continue;

      const slotCoordinates =
        windowsCoordinates[botWindow.type][botWindow.slots[slot].slot];

      if (botWindow.slots[slot].texture && slotCoordinates) {
        const slotImage = new Image();
        slotImage.src = botWindow.slots[slot].texture;

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
          if (botWindow.slots[slot].count > 1) {
            ctx.font = "20px monospace";
            ctx.fillStyle = "black";
            ctx.textAlign = "end";
            ctx.fillText(
              botWindow.slots[slot].count,
              slotCoordinates[0] + 33,
              slotCoordinates[1] + 31
            );
            ctx.fillStyle = "white";
            ctx.fillText(
              botWindow.slots[slot].count,
              slotCoordinates[0] + 32,
              slotCoordinates[1] + 30
            );
          }

          // Draw slot durability (if any)
          if (botWindow.slots[slot].durabilityLeft != null) {
            ctx.fillStyle = 'black';
            ctx.fillRect(
              slotCoordinates[0]+3, 
              slotCoordinates[1]+29, 
              28, 
              3
            );

            ctx.fillStyle = `hsl(${Math.round(botWindow.slots[slot].durabilityLeft*120)}, 100%, 50%)`;
            ctx.fillRect(
              slotCoordinates[0]+3, 
              slotCoordinates[1]+29, 
              Math.round(botWindow.slots[slot].durabilityLeft*28), 
              2
            );
          }
        };
      }
    }
  }, drawWindowThrottleTime);

  onMount(async () => {
    // Fetch Windows Coordinates
    windowsCoordinates = await (
      await fetch("windows/coordinates.json")
    ).json();

    const socket = io({
      path: window.location.pathname + 'socket.io',
    });

    socket.on("window", function (_botWindow) {
      botWindow = receiveWindow(botWindow, _botWindow);
    });

    socket.on("windowUpdate", function (_windowUpdate) {
      botWindow = updateWindow(botWindow, _windowUpdate);
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

  {#if botWindow}
    {#if botWindow.unsupported}
      <p style="color: red;">The current window is not supported but mineflayer-web-inventory will still try to show you inventory updates</p>
    {/if}
    <p>Current Window Id: {botWindow.realId ?? botWindow.id}</p>
    <p>Current Window Type: {botWindow.realType ?? botWindow.type}</p>
  {/if}

  <!-- Lists -->
  {#if showJson && botWindow}
    <pre>{JSON.stringify(botWindow, null, 4)}</pre>
  {/if}

  {#if showItemList && botWindow}
    <SlotList
      slots={Object.values(botWindow.slots)}
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
