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
        fillSlotBackground(oldSlot, "#8b8b8b");
        drawSlotItem(window.slots[oldSlot]);
      }

      if (currentSlot) {
        fillSlotBackground(currentSlot, "#c5c5c5");
        drawSlotItem(window.slots[currentSlot]).then(() => {
          drawSlotNumber(currentSlot);
        });
      }

      oldSlot = currentSlot;
    }
  }

  const drawImage = (
    imageSrc,
    coordinates,
    resizeX,
    resizeY,
    resizeCanvas = false
  ) => {
    return new Promise((resolve) => {
      const image = new Image();
      image.addEventListener("load", function () {
        if (resizeCanvas) {
          canvas.width = image.width;
          canvas.height = image.height;
        }
        if (resizeX && resizeY) {
          ctx.drawImage(
            image,
            coordinates[0],
            coordinates[1],
            resizeX,
            resizeY
          );
        } else {
          ctx.drawImage(image, coordinates[0], coordinates[1]);
        }
        resolve(image);
      });
      image.src = imageSrc;
    });
  };

  const fillSlotBackground = (slotNumber, color) => {
    const slotCoordinates = windowsCoordinates[window.type][slotNumber];
    if (!slotCoordinates) return;

    ctx.fillStyle = color;
    ctx.fillRect(
      slotCoordinates[0],
      slotCoordinates[1],
      windowsCoordinates.slotSize,
      windowsCoordinates.slotSize
    );
  };

  const drawSlotNumber = (slotNumber) => {
    const slotCoordinates = windowsCoordinates[window.type][slotNumber];

    ctx.font = "10px monospace";
    ctx.fillStyle = "white";
    ctx.textAlign = "start";
    ctx.fillText(slotNumber, slotCoordinates[0] + 1, slotCoordinates[1] + 10);
    ctx.fillStyle = "black";
    ctx.fillText(slotNumber, slotCoordinates[0] + 1, slotCoordinates[1] + 10);
  };

  const drawSlotItem = async (slot) => {
    if (!slot) return;

    const slotCoordinates = windowsCoordinates[window.type][slot.slot];
    if (!slotCoordinates || !slot.texture) return;

    ctx.imageSmoothingEnabled = false;
    await drawImage(
      slot.texture,
      slotCoordinates,
      windowsCoordinates.slotSize,
      windowsCoordinates.slotSize,
      false
    );

    // Draw slot count
    if (slot.count > 1) {
      ctx.font = "20px monospace";
      ctx.fillStyle = "black";
      ctx.textAlign = "end";
      ctx.fillText(
        slot.count,
        slotCoordinates[0] + 33,
        slotCoordinates[1] + 31
      );
      ctx.fillStyle = "white";
      ctx.fillText(
        slot.count,
        slotCoordinates[0] + 32,
        slotCoordinates[1] + 30
      );
    }
  };

  const _drawWindow = async () => {
    if (!window || !canvas) return;

    // Draw background
    await drawImage(
      `windows/${window?.type ?? "inventory"}.png`,
      [0, 0],
      null,
      null,
      true // Resize canvas to the image's size
    );

    // Draw hovered slot
    if (currentSlot) fillSlotBackground(currentSlot, "#c5c5c5");

    // Draw slots
    for (const slot in window.slots) {
      if (window.slots[slot]) drawSlotItem(window.slots[slot]);
    }

    // Draw hovered slot number
    if (currentSlot) drawSlotNumber(currentSlot);
  };
  const drawWindow = throttle(_drawWindow, drawWindowThrottleTime);

  // Drag and drop functionality
  let initialSlot;
  let finalSlot;
  let currentSlot;
  let oldSlot;

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
    return Object.keys(windowsCoordinates[window.type])[slotIndex];
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
    });

    canvas.addEventListener("pointerup", (event) => {
      finalSlot = getCursorSlot(event);

      console.log(`Drag and drop from ${initialSlot} to ${finalSlot}`);

      initialSlot = null;
      finalSlot = null;
    });

    canvas.addEventListener("pointerleave", () => {
      initialSlot = null;
      finalSlot = null;
      currentSlot = null;

      drawWindow();
    });

    canvas.addEventListener("pointermove", (event) => {
      const _currentSlot = getCursorSlot(event);
      if (_currentSlot !== currentSlot) currentSlot = _currentSlot;
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
