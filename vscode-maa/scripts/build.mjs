import esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/extension.ts'],
  outdir: 'out',
  mainFields: ['module', 'main'], // jsonc-parser,
  bundle: true,
  sourcemap: true,
  platform: 'node',
  external: ['vscode'],
  minify: true
})
