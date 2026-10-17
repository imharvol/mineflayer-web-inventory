<script lang="ts">
import type { ItemView } from '@shared/messages'

interface Props {
  slots: Array<ItemView | null>
  emptyMessage: string
}

let { slots, emptyMessage }: Props = $props()

const isEmpty = $derived(slots.every((slot) => slot == null))
</script>

{#if isEmpty}
  <p>{emptyMessage}</p>
{:else}
  <ul>
    {#each slots as slot, index (index)}
      {#if slot != null}
        <li>
          Slot {slot.slot}
          <img alt={slot.displayName} src={slot.texture} />
          {slot.displayName}: {slot.count}
        </li>
      {/if}
    {/each}
  </ul>
{/if}

<style>
  ul {
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
    background-color: #2c2c2c;
    border-radius: 2px;
  }

  img {
    image-rendering: pixelated;
    width: 32px;
    height: 32px;
    background-color: #8b8b8b;
    padding: 2px;
  }
</style>
