// Stage the full Skills component for the pinned core's create-content-update.
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: {
  app: { type: 'string' }, core: { type: 'string' }, output: { type: 'string' },
  revision: { type: 'string' }, requires: { type: 'string' }, skill: { type: 'string', multiple: true, default: [] },
} })
const root = resolve(values.app), output = resolve(values.output), core = resolve(values.core)
const revision = Number(values.revision)
if (!Number.isSafeInteger(revision) || revision < 1) throw Error('A positive Skills revision is required')
const requires = JSON.parse(await readFile(values.requires, 'utf8'))
const fromCore = name => import(pathToFileURL(join(core, 'dsh-host', name)))
const { validateRequirements } = await fromCore('content-update-protocol.mjs')
validateRequirements(requires)
const { ContentUpdates } = await fromCore('content-updates.mjs')
const mac = basename(root).endsWith('.app')
const resources = join(root, mac ? 'Contents/Resources' : 'resources')
const product = join(resources, 'product')
const skillsManifestPath = mac ? join(resources, 'bundled-skills.json') : join(root, 'RELEASE-MANIFEST.json')
await new ContentUpdates({ root, product, skillsManifestPath, identity: {} }).unchangedBundledSkills()

const sources = new Map()
for (const item of await readdir(join(product, 'skills'), { withFileTypes: true })) {
  sources.set(item.name, join(product, 'skills', item.name))
}
const music = fileURLToPath(new URL('../skills/ecnu-music/', import.meta.url))
for (const folder of [music, ...values.skill]) {
  const path = resolve(folder), name = basename(path)
  if (!/^[a-z][a-z0-9-]*$/.test(name) || !(await lstat(path)).isDirectory() || !(await lstat(join(path, 'SKILL.md'))).isFile()) throw Error('Expected a named Skill directory with SKILL.md: ' + name)
  sources.set(name, path)
}
const exists = async path => {
  try { await lstat(path); return true } catch (e) { if (e.code === 'ENOENT') return false; throw e }
}
if (await exists(output)) throw Error('Output already exists: ' + output)
const staging = await mkdtemp(join(dirname(output), '.school-skills-'))
try {
  const skills = join(staging, 'skills'), entries = []
  await mkdir(skills)
  for (const [name, source] of sources) {
    const dest = join(skills, name)
    await cp(source, dest, { recursive: true, filter: async path => {
      const info = await lstat(path)
      if (!info.isDirectory() && !info.isFile()) throw Error('Unsupported Skill file: ' + path)
      return true
    } })
    if ((await lstat(dest)).isDirectory() && await exists(join(dest, 'SKILL.md'))) entries.push({ name, requires })
  }
  // The online cache has no sibling product/resources directory.
  const calendar = join(skills, 'calendar-management'), entry = join(calendar, 'SKILL.md')
  const guideLink = '<../../resources/calendar/guide.md>'
  const content = await readFile(entry, 'utf8')
  if (content.includes(guideLink)) {
    await mkdir(join(calendar, 'references'), { recursive: true })
    await cp(join(product, 'resources/calendar/guide.md'), join(calendar, 'references/ecnu-guide.md'), { force: false, errorOnExist: true })
    await writeFile(entry, content.replaceAll(guideLink, '<references/ecnu-guide.md>'))
  }
  await writeFile(join(staging, 'skills.json'), JSON.stringify({ revision, path: 'skills', entries }, null, 2) + '\n')
  await rename(staging, output)
} finally {
  await rm(staging, { recursive: true, force: true })
}
