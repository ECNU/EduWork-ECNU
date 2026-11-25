const external = (name: string) => ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'].includes(name) || name.startsWith('react/') || name.startsWith('react-dom/')
export default { failOnWarn: true, entry: { client: 'src/client.tsx' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022', dts: false, sourcemap: true, clean: false,
  deps: { neverBundle: external, alwaysBundle: name => !external(name) },
  outputOptions: { entryFileNames: 'client.js', banner: 'window.__ModuleLoader__.load({ id: "@chatecnu-work/dsh-ecnu-cloud", factory: (require) => {', footer: 'return module.exports; } });', intro: 'var module = { exports: {} }; var exports = module.exports;' },
}
