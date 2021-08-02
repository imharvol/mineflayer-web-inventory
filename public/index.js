/* global io, Vue, Image, _, windowSlotsCoords */

const socket = io()

socket.on('window', function (window) {
  windowComponent.window = window
})

socket.on('windowUpdate', function (windowUpdate) {
  if (windowUpdate.id !== windowComponent.window.id) return

  // TODO: This works but it's not the best. For some reason the watch function was not
  // being called when a slot changed, I tried to use Vue.set() but I couldn't get it to work
  const newSlots = { ...windowComponent.window.slots, ...windowUpdate.slots }
  windowComponent.window = { ...windowComponent.window, slots: newSlots }
})

const windowComponent = new Vue({
  el: '#window',
  data: {
    window: { id: null, type: null, slots: {} },
    showJSON: false
  },
  computed: {
    isEmpty: function () {
      return !!Object.values(this.window.slots).findIndex(e => e ?? false)
    }
  },
  watch: {
    window: function (newWindow) {
      console.log(newWindow)
      this.throttleDrawWindow(newWindow)
    }
  },
  created: function () {
    this.throttleDrawWindow = _.throttle(drawWindow, 100)
  }
})

// CANVAS
function drawWindow (window) {
  const canvas = document.getElementById('windowCanvas')
  const ctx = canvas.getContext('2d')

  // Draw background
  const windowImage = new Image()
  windowImage.addEventListener('load', function () {
    canvas.width = windowImage.width
    canvas.height = windowImage.height
    ctx.drawImage(windowImage, 0, 0)
  })
  windowImage.src = `/public/windows/${window?.type ?? 'inventory'}.png`

  // Draw items
  for (const item in window.slots) {
    if (!window.slots[item]) continue
    const inventorySlot = windowSlotsCoords[window.type][window.slots[item].slot]

    if (window.slots[item].texture && inventorySlot) {
      const itemImage = new Image()
      itemImage.src = window.slots[item].texture

      itemImage.onload = function () {
        // Draw item image
        ctx.imageSmoothingEnabled = false
        ctx.drawImage(itemImage, inventorySlot[0], inventorySlot[1], 32, 32)

        // Draw item count
        if (window.slots[item].count > 1) {
          ctx.font = '20px monospace'
          ctx.fillStyle = 'black'
          ctx.textAlign = 'end'
          ctx.fillText(window.slots[item].count, inventorySlot[0] + 33, inventorySlot[1] + 31)
          ctx.fillStyle = 'white'
          ctx.fillText(window.slots[item].count, inventorySlot[0] + 32, inventorySlot[1] + 30)
        }
      }
    }
  }
}
