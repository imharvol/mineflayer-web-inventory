const receiveWindow = (oldWindow, newWindow) => {
  // oldWindow might be used in a future implementation
  return newWindow
}

const updateWindow = (window, update) => {
  // Ignore updates that are not from the current window
  if (update.id !== window.id) return

  for (const slot in update.slots) {
    window.slots[slot] = update.slots[slot]
  }

  return window
}

module.exports = { receiveWindow, updateWindow }
