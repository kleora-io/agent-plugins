/**
 * A JSON Schema object as the MCP protocol carries it (`Tool.inputSchema`):
 * loose on purpose, because it is generated from the management API's own
 * OpenAPI document (`scripts/generate-tools.mjs`) rather than modelled here.
 * `$defs`-only self-reference — every `$ref` this package ever emits points
 * at `#/$defs/...` inside the same object, never at another document.
 */
export type JSONSchema = Record<string, unknown>

export type Toolset = 'core' | 'users' | 'tenants' | 'access' | 'clients' | 'audit'

export const TOOLSETS: readonly Toolset[] = [
  'core',
  'users',
  'tenants',
  'access',
  'clients',
  'audit',
]
