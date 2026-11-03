import {Connections} from './connections.js'

export const name = 'ecnu-external-agents'
export function apply(ctx) {
  ctx.plugin(Connections)
}
