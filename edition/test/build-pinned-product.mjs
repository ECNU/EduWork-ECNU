// Build the same product stages used by desktop CI, without creating installers.
// All implementation and dependency pins come from the selected public core.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
const { values } = parseArgs({ options: Object.fromEntries(['core', 'edition', 'output'].map(key => [key, { type: 'string' }])) })
for (const key of ['core', 'edition', 'output']) if (!values[key]) throw Error('Missing --' + key)
const core = resolve(values.core), edition = resolve(values.edition), output = resolve(values.output)
const { pinnedSourceStages } = await import(pathToFileURL(join(core, 'scripts/lib/pinned-source-stages.mjs')))
const { Workspace, runPipeline } = await import(pathToFileURL(join(core, 'scripts/lib/stage-runner.mjs')))
const receipt = JSON.parse(await readFile(join(edition, 'source-receipt.json'), 'utf8'))
const catalog = pinnedSourceStages({ coreRoot: core, editionRoot: edition, version: receipt.version })
const selected = new Set()
function include(name) {
  if (selected.has(name)) return
  const stage = catalog.find(row => row.name === name)
  if (!stage) throw Error('Missing public build stage: ' + name)
  selected.add(name)
  for (const dependency of stage.requires) include(dependency)
}
include('product')
const workspace = new Workspace({ root: output, parameters: { core, edition, version: receipt.version }, stages: catalog.filter(row => selected.has(row.name)), platform: process.platform + '-' + process.arch })
const report = { version: receipt.version, passed: false }
try {
  await workspace.enter()
  report.stages = await runPipeline(workspace, { jobs: 3 })
  report.passed = true
} catch (error) {
  report.error = error.message
  throw error
} finally {
  await workspace.release()
  await mkdir(join(output, 'evidence'), { recursive: true })
  await writeFile(join(output, 'evidence/build.json'), JSON.stringify(report, null, 2) + '\n')
}
