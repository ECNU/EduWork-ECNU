// ECNU's institution layer for the academic calendar. This package owns the
// school's official data and the answers derived from it, and nothing else.
//
// Teaching weeks, examination phases and breaks are background structure, not
// calendar events: writing them as all-day entries repeated on every day was
// the flaw that got the first pilot reverted (#62). They travel as data —
// through the public calendar's annotation slots (#186). Whole-school
// happenings the calendar itself lists — registrations, orientation weeks,
// make-up exams, the sports meet, festivals — are a different kind of fact:
// someone plans around them, so they enter as ordinary all-day events through
// the registered-source seam. The service also answers date queries for the
// tool layer and validates the dataset at load, so a bad transcription fails
// loudly here instead of silently downstream.
import { Service } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'

import { validateDataset, describeDate } from '@eduwork/dsh-academic-calendar/model'
export { validateDataset, weekOf, describeDate, annotationsForDataset, eventsForDataset } from '@eduwork/dsh-academic-calendar/model'

async function loadDatasets(published) {
  const baseline = validateDataset(JSON.parse(await readFile(new URL('../data/2026-2027.json', import.meta.url), 'utf8')))
  if (!published) return [baseline]
  const values = JSON.parse(await readFile(published, 'utf8'))
  if (!Array.isArray(values) || !values.length) throw new Error('ECNU 校历配置缺少学年')
  return values.map(value => {
    const dataset = validateDataset(value)
    // The bundled year's revision may already have been recorded by an older installation.
    return dataset.academicYear === baseline.academicYear && dataset.revision <= baseline.revision ? baseline : dataset
  })
}

export default class EcnuCalendar extends Service {
  constructor(ctx) {
    super(ctx, 'ecnuCalendar')
    this.ready = loadDatasets(process.env.EDUWORK_ACADEMIC_CALENDARS_FILE).then(datasets => {
      this.datasets = datasets
    })
    // Data stays institution-owned; the public education plugin owns semantics,
    // selection, query tools and the projection into ordinary calendar entries.
    ctx.inject(['academicCalendar'], inner => {
      const handles = []
      let gone = false
      this.integration = this.ready.then(async () => {
        for (const [index, dataset] of this.datasets.entries()) {
          if (gone) return
          const year = dataset.academicYear
          const handle = await inner.academicCalendar.registerDataset({
            id: `ecnu-academic-calendar:${year}`,
            label: `华东师范大学 ${year} 学年校历`,
            dataset,
            retainLastAccepted: true,
            source: { provider: 'ecnu-calendar', account: 'institution', feed: `academic-calendar-${year}` },
          })
          if (gone) handle.dispose()
          else {
            handles.push(handle)
            // Earlier public cores return only a disposable handle.
            if (handle.dataset) this.datasets[index] = handle.dataset
          }
        }
      })
      // Keep load/integration errors observable to callers without an unhandled
      // promise rejection if an optional panel has not started reading yet.
      this.integration.catch(error => { this.integrationError = String(error.message ?? error) })
      return () => {
        gone = true
        for (const handle of handles) handle.dispose()
      }
    })
  }

  get dataset() { return this.datasets?.[0] }

  describeDate(date) {
    if (!this.dataset) throw new Error('ECNU 校历数据尚未加载完成')
    const answers = this.datasets.map(dataset => describeDate(dataset, date))
    return answers.find(answer => answer.status !== 'unspecified') ?? answers[0]
  }
}
