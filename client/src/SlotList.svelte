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

<style>
  ul {
    list-style-type: square;
  }
</style>
