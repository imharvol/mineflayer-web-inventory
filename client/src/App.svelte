<script>
  import { throttle } from "lodash";
  import { onMount } from "svelte";

  import { receiveWindow, updateWindow } from "./updateWindow";
  import * as canvasUtils from "./canvasUtils";
  import windowsCoordinatesGenerator from "./windowsCoordinatesGenerator";

  import SlotList from "./SlotList.svelte";

  const drawWindowThrottleTime = 100;

  let canvas;
  let window;
  let showJson = false;
  let showItemList = true;

  let windowsCoordinates = windowsCoordinatesGenerator();

  $: ctx = canvas?.getContext("2d");

  // Draw window reactively when `window` changes
  $: {
    window;

    drawWindow();
  }

  // Update hovered slot
  $: {
    currentSlot;
    if (currentSlot !== oldSlot) {
      if (oldSlot) {
        canvasUtils.fillSlotBackground(canvas, oldSlot, "#8b8b8b");
        canvasUtils.drawSlotItem(canvas, window.slots[oldSlot], initialSlot);
      }

      if (currentSlot) {
        canvasUtils.fillSlotBackground(canvas, currentSlot, "#c5c5c5");
        canvasUtils
          .drawSlotItem(canvas, window.slots[currentSlot], initialSlot)
          .then(() => {
            canvasUtils.drawSlotNumber(canvas, currentSlot);
          });
      }

      oldSlot = currentSlot;
    }
  }

  const _drawWindow = async () => {
    if (!window || !canvas) return;

    // Draw background
    await canvasUtils.drawImage(
      canvas,
      `windows/${window?.type ?? "inventory"}.png`,
      [0, 0],
      null,
      null,
      true // Resize canvas to the image's size
    );

    // Draw hovered slot
    if (currentSlot)
      canvasUtils.fillSlotBackground(canvas, currentSlot, "#c5c5c5");

    // Draw slots
    for (const slot in window.slots) {
      if (window.slots[slot])
        await canvasUtils.drawSlotItem(canvas, window.slots[slot], initialSlot);
    }

    // Draw hovered slot number
    if (currentSlot) canvasUtils.drawSlotNumber(canvas, currentSlot);
  };
  const drawWindow = throttle(_drawWindow, drawWindowThrottleTime);

  // Hovering functionality
  let currentSlot;
  let oldSlot;

  // Drag and drop functionality
  let initialSlot;

  const getCursorCoordinates = (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return [x, y];
  };

  const getCursorSlot = (event) => {
    const cursorCoordinates = getCursorCoordinates(event);

    const slotIndex = Object.values(windowsCoordinates[window.type]).findIndex(
      (slotCoordinates) =>
        cursorCoordinates[0] > slotCoordinates[0] &&
        cursorCoordinates[0] <=
          slotCoordinates[0] + windowsCoordinates.slotSize &&
        cursorCoordinates[1] > slotCoordinates[1] &&
        cursorCoordinates[1] <= slotCoordinates[1] + windowsCoordinates.slotSize
    );

    if (slotIndex === -1) return null;
    return Number(Object.keys(windowsCoordinates[window.type])[slotIndex]);
  };

  const dragAndDrop = (fromSlotNumber, toSlotNumber) => {
    console.log(`Drag and drop from ${fromSlotNumber} to ${toSlotNumber}`);
  };

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

    canvas.addEventListener("pointerdown", (event) => {
      initialSlot = getCursorSlot(event);
      if (initialSlot) drawWindow();
    });

    canvas.addEventListener("pointerup", (event) => {
      const finalSlot = getCursorSlot(event);
      if (initialSlot && finalSlot) dragAndDrop(initialSlot, finalSlot);
      if (initialSlot) drawWindow();
      initialSlot = null;
    });

    canvas.addEventListener("pointerleave", () => {
      initialSlot = null;
      currentSlot = null;

      drawWindow();
    });

    canvas.addEventListener("pointermove", (event) => {
      const _currentSlot = getCursorSlot(event);
      if (_currentSlot !== currentSlot) {
        currentSlot = _currentSlot;

        // If a drag and drop is happening, re-draw the window
        if (initialSlot) drawWindow();
      }
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
      <p style="color: red;">
        The current window is not supported but mineflayer-web-inventory will
        still try to show you inventory updates
      </p>
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
