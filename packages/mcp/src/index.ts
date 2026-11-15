/**
 * The CLI entry point. `bin.kleora-mcp` in `package.json` points here; a
 * host launches this file with `node` and talks to it over stdio: this is a
 * local stdio server, never a hosted one. `tsup.config.ts`'s
 * `banner` adds the `#!/usr/bin/env node` line at build time, so
 * `dist/index.js` is directly executable on its own too.
 *
 * Nothing here reads a credential from `argv` or `process.env` — see
 * `config.ts` for what configuration this process does accept. The one secret
 * it holds, a refresh token, lives in the credential store from
 * `@kleora-io/core` (the OS keychain, or a `0600` file).
 */
import { loadConfig } from './config.js'
import { formatLogoutOutcome, logout } from './logout.js'
import { buildServer } from './server.js'

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const config = loadConfig({ argv })

  // `--logout` is a mode, not configuration: it never starts the stdio
  // server, so it prints to stdout rather than stderr (nothing is speaking
  // JSON-RPC on this run). The Claude Code plugin's `/kleora:logout`
  // command is the intended caller.
  if (argv.includes('--logout')) {
    const outcome = await logout(config)
    console.log(formatLogoutOutcome(outcome, config))
    return
  }

  const { connect } = await buildServer(config)
  await connect()
  // The stdio transport keeps the process alive on its own; nothing else to
  // await here. `console.error` (not `.log`) for anything diagnostic — stdout
  // is the JSON-RPC channel and a stray line on it is a corrupted message.
  console.error(
    `kleora-mcp: connected (base-url=${config.baseUrl}, profile=${config.profile}, ` +
      `read-only=${config.readOnly}, toolsets=${config.toolsets.join(',')})`,
  )
}

main().catch((error: unknown) => {
  console.error('kleora-mcp: fatal error', error)
  process.exitCode = 1
})
