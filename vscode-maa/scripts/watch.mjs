import esbuild from 'esbuild'

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  outdir: 'out',
  mainFields: ['module', 'main'], // jsonc-parser,
  bundle: true,
  sourcemap: true,
  platform: 'node',
  external: ['vscode']
})

await ctx.watch()
