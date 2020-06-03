var socket = io()

socket.on('inventory', function (inv) {
  inventoryComponent.inventory = inv
})

var inventoryComponent = new Vue({
  el: '#inventory',
  data: {
    inventory: {}
  }
})
