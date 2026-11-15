import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const product = resolve(process.argv[2])
const read = async path => JSON.parse(await readFile(join(product, path), 'utf8'))
const identity = await read('assembly.json')
const require = createRequire(join(product, 'd/package.json'))
const { composeEntries } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')))
const active = composeEntries(await read('composition.json'), () => {}).filter(row => row.disabled !== true)
const calendar = '@eduwork/dsh-calendar'
for (const name of [calendar, calendar + '-subscriptions', '@eduwork/dsh-academic-calendar', '@chatecnu-work/dsh-ecnu-calendar']) {
  assert.ok(identity.sourcePackages.includes(name), 'Missing calendar package ' + name)
  assert.equal(active.filter(row => row.name === name).length, 1, 'Expected one active ' + name)
  require.resolve(name)
  if (name.startsWith('@eduwork/')) {
    require.resolve(name + '/tools')
    assert.equal(active.filter(row => row.name === name + '/tools').length, 1)
  }
}
require.resolve(calendar + '/client')
const data = await read('d/node_modules/@chatecnu-work/dsh-ecnu-calendar/data/2026-2027.json')
assert.equal(data.academicYear, '2026-2027')
assert.ok(data.events.some(row => row.uid === 'graduate-arrival-2026'))
for (const name of ['calendar-management', 'calendar-subscriptions', 'academic-calendar']) {
  const skill = await readFile(join(product, 'skills', name, 'SKILL.md'), 'utf8')
  assert.ok(skill.includes('name: ' + name))
  if (name === 'calendar-management') assert.ok(skill.includes('resources/calendar/guide.md'))
}
console.log('Verified school calendar, three public plugins, tools and Skills in the assembled product')
