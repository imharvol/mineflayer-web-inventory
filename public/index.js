/* global io, Vue, Image, _ */

const socket = io()

socket.on('inventory', function (inv) {
  inventoryComponent.inventory = inv
})

socket.on('inventoryUpdate', function (inventoryUpdate) {
  for (const slot in inventoryUpdate) {
    const newItem = inventoryUpdate[slot]

    const itemIndex = inventoryComponent.inventory.findIndex(e => e.slot === parseInt(slot))

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
  }
})

const inventoryComponent = new Vue({
  el: '#inventory',
  data: {
    inventory: [],
    showJSON: false
  },
  watch: {
    inventory: function (newInventory) {
      this.throttleDrawInventory(newInventory)
    }
  },
  created: function () {
    this.throttleDrawInventory = _.throttle(drawInventory, 100)
  }
})

// Might be better to hardcode all the values
const inventorySlots = {
  // Crafting slots
  0: [307, 55],
  1: [195, 35],
  2: [231, 35],
  3: [195, 71],
  4: [231, 71],

  5: [15, 15], // Helmet
  9: [15, 167], // Inventory
  18: [15, 203], // Inventory
  27: [15, 239], // Inventory
  36: [15, 283], // Tool bar
  45: [153, 123] // Left hand
}

// Add tool bar slots (36 - 44)
for (let i = 36 + 1; i <= 44; i++) {
  inventorySlots[i] = [inventorySlots[i - 1][0] + 36, inventorySlots[i - 1][1]]
}

// Add armor slots (5 - 8)
for (let i = 5 + 1; i <= 8; i++) {
  inventorySlots[i] = [inventorySlots[i - 1][0], inventorySlots[i - 1][1] + 36]
}

// Add inventory slots (9 - 35)
for (let i = 9 + 1; i <= 17; i++) {
  inventorySlots[i] = [inventorySlots[i - 1][0] + 36, inventorySlots[i - 1][1]]
}
for (let i = 18 + 1; i <= 26; i++) {
  inventorySlots[i] = [inventorySlots[i - 1][0] + 36, inventorySlots[i - 1][1]]
}
for (let i = 27 + 1; i <= 35; i++) {
  inventorySlots[i] = [inventorySlots[i - 1][0] + 36, inventorySlots[i - 1][1]]
}

// CANVAS
function drawInventory (inventory) {
  const canvas = document.getElementById('inventoryCanvas')
  const ctx = canvas.getContext('2d')

  // Draw background
  ctx.drawImage(document.getElementById('inventoryImage'), 0, 0)

  // Draw items
  for (const item in inventory) {
    const inventorySlot = inventorySlots[inventory[item].slot]

    if (inventory[item].texture && inventorySlot) {
      const itemImage = new Image()
      itemImage.src = inventory[item].texture

      itemImage.onload = function () {
        // Draw item image
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(itemImage, inventorySlot[0], inventorySlot[1], 32, 32)

        // Draw item count
        if (inventory[item].count > 1) {
          ctx.font = '20px monospace'
          ctx.fillStyle = 'black'
          ctx.textAlign = 'end'
          ctx.fillText(inventory[item].count, inventorySlot[0] + 33, inventorySlot[1] + 31)
          ctx.fillStyle = 'white'
          ctx.fillText(inventory[item].count, inventorySlot[0] + 32, inventorySlot[1] + 30)
        }
      }
    }
  }
}
