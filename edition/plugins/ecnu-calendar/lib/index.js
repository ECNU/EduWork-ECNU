// ECNU's institution layer for the academic calendar. This package owns the
// school's official data and the answers derived from it, and nothing else.
//
// Teaching weeks, examination phases and breaks are background structure, not
// calendar events: writing them as all-day entries repeated on every day was
// the flaw that got the first pilot reverted (#62), and the agreed direction
// (#186) keeps them as data, presented through the public calendar's display
// slots once that contract lands. Until then this service answers date
// queries for the tool layer and validates the dataset at load, so a bad
// transcription fails loudly here instead of silently downstream.
import { Service } from '@deepseek-ai/cordis'
import { readFile } from 'node:fs/promises'

const DAY_MS = 24 * 60 * 60 * 1000

function dayIndex(date) {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / DAY_MS)
}

function requireDate(value, what) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T00:00:00Z'))) {
    throw new Error(`校历数据 ${what} 不是合法日期：${value}`)
  }
}

/** Week `n` of a term: seven days from `firstDay`, the last week cut at `lastDay`. */
export function weekOf(term, date) {
  if (!term.weekCount) return undefined
  const offset = dayIndex(date) - dayIndex(term.firstDay)
  if (offset < 0) return undefined
  const week = Math.floor(offset / 7) + 1
  if (week > term.weekCount || dayIndex(date) > dayIndex(term.lastDay)) return undefined
  return week
}

export function validateDataset(dataset) {
  if (dataset?.schemaVersion !== 2) throw new Error('校历数据 schemaVersion 必须为 2')
  if (typeof dataset.academicYear !== 'string' || !dataset.academicYear) throw new Error('校历数据缺少学年标识')
  // Terms and breaks tile the year and must not overlap each other; phases sit
  // inside their own term and are checked against their siblings only.
  const topLevel = []
  const checkTopLevel = (span, what) => {
    requireDate(span.firstDay, `${what}.firstDay`)
    requireDate(span.lastDay, `${what}.lastDay`)
    if (dayIndex(span.lastDay) < dayIndex(span.firstDay)) throw new Error(`校历数据 ${what} 结束日期早于开始日期`)
    for (const [owner, kind] of topLevel) {
      if (dayIndex(span.firstDay) <= owner.last && dayIndex(span.lastDay) >= owner.first) {
        throw new Error(`校历数据 ${what} 与 ${kind} 日期重叠`)
      }
    }
    topLevel.push([{ first: dayIndex(span.firstDay), last: dayIndex(span.lastDay) }, what])
  }
  if (!Array.isArray(dataset.terms) || dataset.terms.length === 0) throw new Error('校历数据缺少学期')
  for (const term of dataset.terms) {
    if (typeof term.id !== 'string' || !term.id) throw new Error('校历学期缺少 id')
    if (typeof term.name !== 'string' || !term.name) throw new Error(`校历学期 ${term.id} 缺少名称`)
    checkTopLevel(term, `学期 ${term.id}`)
    if (term.weekCount !== undefined) {
      if (!Number.isSafeInteger(term.weekCount) || term.weekCount < 1) throw new Error(`校历学期 ${term.id} 的 weekCount 必须是正整数`)
      // A term's last week may be cut short by lastDay, so the count is the
      // covered span rounded up, never more and never less.
      const covered = (dayIndex(term.lastDay) - dayIndex(term.firstDay) + 1) / 7
      if (term.weekCount !== Math.ceil(covered - 1e-9)) throw new Error(`校历学期 ${term.id} 的 weekCount 与日期范围不符`)
    }
    if (!Array.isArray(term.phases) || term.phases.length === 0) throw new Error(`校历学期 ${term.id} 缺少阶段`)
    const phaseSpans = []
    for (const phase of term.phases) {
      if (!['teaching', 'examination'].includes(phase.kind)) throw new Error(`校历学期 ${term.id} 含未知阶段类型 ${phase.kind}`)
      requireDate(phase.firstDay, `学期 ${term.id} 阶段 ${phase.kind}.firstDay`)
      requireDate(phase.lastDay, `学期 ${term.id} 阶段 ${phase.kind}.lastDay`)
      if (dayIndex(phase.firstDay) < dayIndex(term.firstDay) || dayIndex(phase.lastDay) > dayIndex(term.lastDay)) {
        throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 超出学期范围`)
      }
      for (const [owner] of phaseSpans) {
        if (dayIndex(phase.firstDay) <= owner.last && dayIndex(phase.lastDay) >= owner.first) {
          throw new Error(`校历学期 ${term.id} 的阶段 ${phase.kind} 与其他阶段重叠`)
        }
      }
      phaseSpans.push([{ first: dayIndex(phase.firstDay), last: dayIndex(phase.lastDay) }])
      if (phase.weeks !== undefined) {
        if (!Array.isArray(phase.weeks) || phase.weeks.length !== 2 || phase.weeks.some(value => !Number.isSafeInteger(value) || value < 1)) {
          throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 的 weeks 必须是 [起, 止] 周号`)
        }
        if (!term.weekCount || phase.weeks[1] > term.weekCount) throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 的周号超出 weekCount`)
        if (phase.weeks[1] < phase.weeks[0]) throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 的周号区间颠倒`)
        if (dayIndex(phase.firstDay) !== dayIndex(term.firstDay) + (phase.weeks[0] - 1) * 7) {
          throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 的起始日期与周号不符`)
        }
        const naturalEnd = dayIndex(term.firstDay) + phase.weeks[1] * 7 - 1
        if (dayIndex(phase.lastDay) > naturalEnd) {
          throw new Error(`校历学期 ${term.id} 阶段 ${phase.kind} 的结束日期超出周号范围`)
        }
      }
    }
  }
  for (const rest of dataset.breaks ?? []) {
    if (typeof rest.id !== 'string' || !rest.id || typeof rest.name !== 'string' || !rest.name) throw new Error('校历假期缺少 id 或名称')
    checkTopLevel(rest, `假期 ${rest.id}`)
  }
  for (const event of dataset.events ?? []) {
    if (typeof event.uid !== 'string' || !event.uid || typeof event.title !== 'string' || !event.title) throw new Error('校历事项缺少 uid 或标题')
    requireDate(event.date, `事项 ${event.uid}.date`)
  }
  return dataset
}

/** What the official calendar says about one local date; unstated days are `unspecified`. */
export function describeDate(dataset, date) {
  requireDate(date, '查询日期')
  const answer = { date, academicYear: dataset.academicYear, status: 'unspecified' }
  for (const rest of dataset.breaks ?? []) {
    if (dayIndex(date) >= dayIndex(rest.firstDay) && dayIndex(date) <= dayIndex(rest.lastDay)) {
      return { ...answer, status: 'break', break: { id: rest.id, name: rest.name } }
    }
  }
  for (const term of dataset.terms) {
    if (dayIndex(date) < dayIndex(term.firstDay) || dayIndex(date) > dayIndex(term.lastDay)) continue
    const week = weekOf(term, date)
    const phase = term.phases.find(candidate => dayIndex(date) >= dayIndex(candidate.firstDay) && dayIndex(date) <= dayIndex(candidate.lastDay))
    return {
      ...answer,
      status: 'term',
      term: { id: term.id, name: term.name },
      ...(week === undefined ? {} : { week, weekParity: week % 2 === 1 ? '单周' : '双周' }),
      ...(phase ? { phase: { kind: phase.kind, name: phase.name } } : {}),
    }
  }
  return answer
}

export default class EcnuCalendar extends Service {
  constructor(ctx) {
    super(ctx, 'ecnuCalendar')
    this.dataset = null
    this.ready = readFile(new URL('../data/2026-2027.json', import.meta.url), 'utf8').then(text => {
      this.dataset = validateDataset(JSON.parse(text))
    })
  }

  describeDate(date) {
    if (!this.dataset) throw new Error('ECNU 校历数据尚未加载完成')
    return describeDate(this.dataset, date)
  }
}
