import { readFile } from 'node:fs/promises'

export const name = 'ecnu-calendar'
export const inject = ['calendar']

/** Runs when the calendar service is ready, independently of Agent conversations. */
export async function apply(ctx) {
  const dataset = JSON.parse(await readFile(new URL('../data/2026-2027.json', import.meta.url), 'utf8'))
  const source = ctx.calendar.registerSource({ provider: 'ecnu.edu.cn', account: 'public',
    feed: `academic-calendar:${dataset.academicYear}`, label: `ECNU 校历 ${dataset.academicYear}` })
  ctx.effect(() => () => source.dispose(), 'ecnu-calendar: unregister bundled calendar')
  let result
  try {
    result = await source.apply({ revision: dataset.revision, complete: true, events: dataset.events })
  } catch (error) {
    // An older edition must keep the newer registered cache visible, without downgrading it.
    if (['stale_revision', 'revision_conflict'].includes(error.message)) return
    throw error
  }
  if (result.state !== 'ready') throw new Error('ECNU calendar initialization failed')
}
