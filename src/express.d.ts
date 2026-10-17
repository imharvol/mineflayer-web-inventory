declare module 'express' {
  import type { ExpressFactory } from './options'

  const createExpressApp: ExpressFactory
  export default createExpressApp
}
