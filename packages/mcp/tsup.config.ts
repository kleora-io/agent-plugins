import { defineConfig } from 'tsup'

// ESM only: this package is a standalone stdio process launched by a host
// (`node dist/index.js`), never `require`d as a library, so there is no CJS
// consumer to serve and no dual-package hazard to avoid.
//
// Every dependency, `@kleora-io/core` included, stays external: whoever
// installs this package from npm installs them beside it. The Claude Code
// plugin, which has no `node_modules`, uses `tsup.plugin.config.ts` instead.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // `@napi-rs/keyring` resolves a different native `.node` binding per
  // platform at its own require-time (`@kleora-io/core` loads it dynamically
  // for exactly this reason). Bundling it would have esbuild try to statically
  // resolve every platform's binding at build time, on the machine building
  // this package, and fail on whichever ones are not the one it is running on.
  external: ['@napi-rs/keyring'],
  banner: {
    // `bin.kleora-mcp` in package.json expects `dist/index.js` to be
    // directly executable, and a host that launches it with `node` still
    // benefits from the shebang once someone `chmod +x`s it.
    js: '#!/usr/bin/env node',
  },
})
