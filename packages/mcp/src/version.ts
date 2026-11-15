/**
 * The version this package reports in `User-Agent` and in the MCP server's
 * own `Implementation.version`. The `User-Agent` follows the convention every
 * Kleora SDK uses: `<package>/<version>`.
 *
 * A literal rather than a `package.json` import: `verbatimModuleSyntax` and
 * `moduleResolution: bundler` make a JSON import a build-tool detail this
 * file should not carry, and a unit test asserts it equals the manifest so
 * the two cannot drift silently.
 */
export const VERSION = '0.1.0'

/** `kleora-mcp/{version}`, sent with every management API request. */
export const USER_AGENT = `kleora-mcp/${VERSION}`
