import type { ClientToServerEvents, ServerToClientEvents } from '@shared/messages'
import { io, type Socket } from 'socket.io-client'

export type InventorySocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** The server derives its socket path from the same page-location rule. */
export function connect(): InventorySocket {
  return io({ path: `${window.location.pathname}socket.io` })
}
