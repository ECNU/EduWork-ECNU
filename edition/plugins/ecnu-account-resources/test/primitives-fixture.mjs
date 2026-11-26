import { createRequire } from 'node:module'
import { join } from 'node:path'
import { readFile, readdir } from 'node:fs/promises'

// Exercise the pinned SDK's actual components and modal focus behavior.
export async function primitivesAssets() {
  const runtime = process.env.EDUWORK_TEST_RUNTIME
  if (!runtime) throw Error('Select the pinned runtime with EDUWORK_TEST_RUNTIME')
  const { build } = createRequire(join(runtime, 'package.json'))('esbuild')
  const entry = [
    "export {Menu, MenuItemButton} from '@deepseek-ai/dsh-client-ui-primitives/src/Menu.tsx'",
    ...['Button', 'Modal', 'Tooltip'].map(name => `export {${name}} from '@deepseek-ai/dsh-client-ui-primitives/src/${name}.tsx'`),
    "export {ICON_SYMBOLS,IconSparkleRegular,IconRefreshOutlineRegular,IconCopyOutlineRegular} from '@deepseek-ai/dsh-client-ui-primitives/src/icons/index.tsx'",
  ].join('\n')
  const primitives = await build({ stdin: { contents: entry, resolveDir: runtime, loader: 'js' }, outfile: 'primitives.js', bundle: true, write: false, format: 'iife', globalName: 'DSHPrimitives', platform: 'browser', jsx: 'automatic', external: ['react', 'react/*', 'react-dom', 'react-dom/*'], nodePaths: process.env.EDUWORK_UI_TEST_DEPS ? [process.env.EDUWORK_UI_TEST_DEPS] : [] })
  const themeRoot = join(runtime, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/assets')
  const styles = join(runtime, 'node_modules/@deepseek-ai/dsh-client-ui-theme/src/styles')
  const theme = (await Promise.all([
    ...(await readdir(themeRoot)).filter(name => name.endsWith('.css')).map(name => join(themeRoot, name)),
    ...['base.css', 'corner-shape.css', 'design-platform.css', 'focus.css', 'scrollbar.css'].map(name => join(styles, name)),
  ].map(path => readFile(path, 'utf8')))).join('\n')
  return [
    ['/primitives.js', primitives.outputFiles.find(file => file.path.endsWith('.js')).contents],
    ['/primitives.css', primitives.outputFiles.find(file => file.path.endsWith('.css')).contents],
    ['/theme.css', theme],
  ]
}
export const primitivesHead = '<link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/primitives.css">'
export const primitivesScript = '<script>window.require=name=>name==="react"?React:name==="react-dom"?ReactDOM:name==="react/jsx-runtime"?{Fragment:React.Fragment,jsx:(t,p,k)=>React.createElement(t,{...p,key:k}),jsxs:(t,p,k)=>React.createElement(t,{...p,key:k})}:undefined</script><script src="/primitives.js"></script>'
