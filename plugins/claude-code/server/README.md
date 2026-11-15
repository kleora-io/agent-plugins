# Both files here are generated — do not edit either

`kleora-mcp.mjs` is `packages/mcp` built as a single self-contained file,
because an installed plugin has no `node_modules`: the host copies this
directory and runs `node ${CLAUDE_PLUGIN_ROOT}/server/kleora-mcp.mjs`, so
anything the file does not carry itself would be a crash on the first tool
call. `@kleora-io/core`, from npm, is compiled in with everything else.

`THIRD-PARTY-NOTICES` is the attribution that has to travel with it. Compiling
a dependency into the bundle makes the bundle a copy of it, and the
third-party packages in there are licensed MIT, BSD-3-Clause and ISC, each of
which requires its copyright notice and permission text to be included with
copies. It is written from the same build's esbuild metafile, which is the
only honest source for the list: `packages/mcp/package.json` declares a few
dependencies and a bundler inlines their transitive ones too.

Edit the TypeScript in `packages/mcp/src`, then, from the repository root:

```bash
pnpm plugin-server        # rebuild and rewrite both files here
pnpm check:plugin-server  # rebuild into a temp dir and diff — what CI runs
```

The write and the check are two commands on purpose: a gate that repaired the
tree it was checking would make the drift undetectable.

The one module deliberately left outside the bundle is `@napi-rs/keyring` — a
different native binding per platform, resolved at its own require-time, and
optional by design. `@kleora-io/core` imports it inside a `try`, so the server
runs with no keychain module present (on the `0600` file store) and picks the
keychain up when the `optionalDependencies` entry in
`plugins/claude-code/package.json` has been installed.
