/* global io, Vue */

var socket = io()

socket.on('inventory', function (inv) {
  inventoryComponent.inventory = inv
})

socket.on('inventoryUpdate', function (slot, newItem) {
  const itemIndex = inventoryComponent.inventory.findIndex(e => e.slot === slot)

  if (itemIndex >= 0) {
    if (!newItem) { // If the item has been removed
      inventoryComponent.inventory.splice(itemIndex, 1)
    } else {
      Vue.set(inventoryComponent.inventory, itemIndex, newItem)
    }
  } else {
    if (newItem) {
      inventoryComponent.inventory.push(newItem)
    }
  }
})

var inventoryComponent = new Vue({
  el: '#inventory',
  data: {
    inventory: []
  }
})
