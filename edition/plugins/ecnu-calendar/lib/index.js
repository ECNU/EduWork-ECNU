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

export default class EcnuCalendar extends Service {
  constructor(ctx) {
    super(ctx, 'ecnuCalendar')
    this.dataset = null
    this.ready = readFile(new URL('../data/2026-2027.json', import.meta.url), 'utf8').then(text => {
      this.dataset = validateDataset(JSON.parse(text))
    })
    // Data stays institution-owned; the public education plugin owns semantics,
    // selection, query tools and the projection into ordinary calendar entries.
    ctx.inject(['academicCalendar'], inner => {
      let handle
      let gone = false
      this.integration = this.ready.then(async () => {
        if (gone) return
        handle = await inner.academicCalendar.registerDataset({
          id: `ecnu-academic-calendar:${this.dataset.academicYear}`,
          label: `ECNU ${this.dataset.academicYear} 本科校历`,
          dataset: this.dataset,
          source: { provider: 'ecnu-calendar', account: 'institution', feed: `academic-calendar-${this.dataset.academicYear}` },
        })
        if (gone) handle.dispose()
      })
      // Keep load/integration errors observable to callers without an unhandled
      // promise rejection if an optional panel has not started reading yet.
      this.integration.catch(error => { this.integrationError = String(error.message ?? error) })
      return () => { gone = true; handle?.dispose() }
    })
  }

  describeDate(date) {
    if (!this.dataset) throw new Error('ECNU 校历数据尚未加载完成')
    return describeDate(this.dataset, date)
  }
}
