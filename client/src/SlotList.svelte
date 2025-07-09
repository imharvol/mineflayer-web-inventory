<script>
  export let slots = [];
  export let emptyMessage = "The window is empty";

  $: isEmpty = slots.findIndex((e) => e != null) === -1;
</script>

<ul>
  {#if isEmpty}
    <p>{emptyMessage}</p>
  {:else}
    {#each slots as slot, i (i)}
      {#if slot != null}
        <li>
          Slot {slot.slot} <img alt={slot.displayName} src={slot.texture} />
          {slot.displayName}: {slot.count}
        </li>
      {/if}
    {/each}
  {/if}
</ul>

<style>  ul {
    list-style-type: none;
    padding: 0;
    margin: 16px 0;
    background-color: #373737;
    border: 2px solid #727272;
    padding: 16px;
    border-radius: 4px;
    max-height: 300px;
    overflow-y: auto;
  }

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
    padding: 8px;
    background-color: #2C2C2C;
    border-radius: 2px;
  }

  img {
    image-rendering: pixelated;
    width: 32px;
    height: 32px;
    background-color: #8B8B8B;
    padding: 2px;
  }
</style>
