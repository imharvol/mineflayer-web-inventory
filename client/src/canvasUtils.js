/* global Image */

import windowsCoordinatesGenerator from './windowsCoordinatesGenerator'

const windowsCoordinates = windowsCoordinatesGenerator()

export const drawImage = (
  canvas,
  imageSrc,
  coordinates,
  resizeX,
  resizeY,
  resizeCanvas = false
) => {
  return new Promise((resolve) => {
    const ctx = canvas?.getContext('2d')

    const image = new Image()
    image.addEventListener('load', function () {
      if (resizeCanvas) {
        canvas.width = image.width
        canvas.height = image.height
      }
      if (resizeX && resizeY) {
        ctx.drawImage(
          image,
          coordinates[0],
          coordinates[1],
          resizeX,
          resizeY
        )
      } else {
        ctx.drawImage(image, coordinates[0], coordinates[1])
      }
      resolve(image)
    })
    image.src = imageSrc
  })
}

export const fillSlotBackground = (canvas, slotNumber, color) => {
  const ctx = canvas?.getContext('2d')

  const slotCoordinates = windowsCoordinates[window.type][slotNumber]
  if (!slotCoordinates) return

  ctx.fillStyle = color
  ctx.fillRect(
    slotCoordinates[0],
    slotCoordinates[1],
    windowsCoordinates.slotSize,
    windowsCoordinates.slotSize
  )
}

export const drawSlotNumber = (canvas, slotNumber) => {
  const ctx = canvas?.getContext('2d')

  const slotCoordinates = windowsCoordinates[window.type][slotNumber]

  ctx.font = '10px monospace'
  ctx.fillStyle = 'white'
  ctx.textAlign = 'start'
  ctx.fillText(slotNumber, slotCoordinates[0] + 1, slotCoordinates[1] + 10)
  ctx.fillStyle = 'black'
  ctx.fillText(slotNumber, slotCoordinates[0] + 1, slotCoordinates[1] + 10)
}

export const drawSlotItem = async (canvas, slot, initialSlot) => {
  const ctx = canvas?.getContext('2d')

  if (!slot) return

  const _globalAlpha = ctx.globalAlpha
  if (initialSlot === slot.slot) {
    ctx.globalAlpha = 0.3
  }

  const slotCoordinates = windowsCoordinates[window.type][slot.slot]
  if (!slotCoordinates || !slot.texture) return

  ctx.imageSmoothingEnabled = false
  await drawImage(
    canvas,
    slot.texture,
    slotCoordinates,
    windowsCoordinates.slotSize,
    windowsCoordinates.slotSize,
    false
  )

  // Draw slot count
  if (slot.count > 1) {
    ctx.font = '20px monospace'
    ctx.fillStyle = 'black'
    ctx.textAlign = 'end'
    ctx.fillText(
      slot.count,
      slotCoordinates[0] + 33,
      slotCoordinates[1] + 31
    )
    ctx.fillStyle = 'white'
    ctx.fillText(
      slot.count,
      slotCoordinates[0] + 32,
      slotCoordinates[1] + 30
    )
  }

  ctx.globalAlpha = _globalAlpha
}
