/**
 * Where *this* tool's credential lives.
 *
 * The code that reads and writes it is shared with the CLI
 * (`@kleora-io/core`); these two strings are not, and deliberately so.
 *
 * The two tools do not share a stored credential, and cannot: a refresh token
 * is bound to the OAuth client it was issued to, and the CLI is a different
 * client from this server. They share the code that stores one. The MCP
 * server keeps `~/.kleora-mcp` and its `kleora-mcp` keychain service; the CLI
 * uses `~/.kleora-cli` and `kleora-cli`.
 *
 * So these values are frozen: changing either would make every existing MCP
 * user sign in again, and would orphan a refresh token that nothing can then
 * find in order to revoke it.
 */

/** The keychain service name. Frozen — see above. */
export const KEYCHAIN_SERVICE = 'kleora-mcp'

/** `~/.kleora-mcp`, the `0600` fallback store. Frozen — see above. */
export const CONFIG_DIR_NAME = 'kleora-mcp'
