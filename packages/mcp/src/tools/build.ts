/**
 * Turns the generated operations plus the hand-written catalog into the
 * tools this server actually advertises.
 *
 * The tool list is built once, from static data, and does not vary by
 * caller: the tool list does not vary by permission. Advertising only what today's caller can use would be wrong for the
 * next environment in the same session, and would make "you lack
 * permission" indistinguishable from "that does not exist".
 */
import { CATALOG, type CatalogEntry } from './catalog.js'
import { OPERATIONS, type GeneratedOperation } from '../generated/operations.js'
import type { JSONSchema, Toolset } from '../types.js'

export interface ToolAnnotations {
  readOnlyHint: boolean
  idempotentHint: boolean
  openWorldHint: boolean
  /** Present only when `true`: no read tool carries it at all. */
  destructiveHint?: true
}

export interface BuiltTool {
  readonly name: string
  readonly toolset: Toolset
  readonly title: string
  readonly description: string
  readonly inputSchema: JSONSchema
  readonly annotations: ToolAnnotations
  readonly operation: GeneratedOperation
  /** The response field withheld unless the call opts in, or `null`. */
  readonly secretField: string | null
}

const IDEMPOTENT_METHODS = new Set(['get', 'put', 'delete'])

/** Adds the `return_secret` opt-in to a copy of the operation's schema (see `catalog.ts`). */
function withSecretOptIn(schema: JSONSchema): JSONSchema {
  const properties = { ...(schema['properties'] as Record<string, unknown> | undefined) }
  properties['return_secret'] = {
    type: 'boolean',
    default: false,
    title: 'Return secret',
    description:
      'The management API shows this secret exactly once. Leave this false to get the ' +
      'id, prefix and metadata with the secret withheld; set it true only when the secret ' +
      'itself is needed for this call.',
  }
  return { ...schema, properties }
}

function buildOne(entry: CatalogEntry, operation: GeneratedOperation): BuiltTool {
  const readOnly = operation.method === 'get'
  const annotations: ToolAnnotations = {
    readOnlyHint: readOnly,
    idempotentHint: IDEMPOTENT_METHODS.has(operation.method),
    openWorldHint: false,
    ...(entry.destructive ? { destructiveHint: true as const } : {}),
  }
  const description = [operation.summary, operation.description]
    .filter((part): part is string => Boolean(part))
    .join('\n\n')

  return {
    name: entry.name,
    toolset: entry.toolset,
    title: operation.summary || entry.name,
    description: description || entry.name,
    inputSchema: entry.secretField === null ? operation.inputSchema : withSecretOptIn(operation.inputSchema),
    annotations,
    operation,
    secretField: entry.secretField,
  }
}

/** Every tool this server could ever advertise — one entry per catalog row. */
export const ALL_TOOLS: readonly BuiltTool[] = CATALOG.map((entry) => {
  const operation = OPERATIONS[entry.operationId]
  if (!operation) throw new Error(`invariant: no generated operation for '${entry.operationId}'`)
  return buildOne(entry, operation)
})

export interface ToolFilter {
  toolsets: readonly Toolset[]
  readOnly: boolean
}

/**
 * What a given configuration actually lists. `--read-only` drops every
 * non-read tool from the list regardless of toolset, because a host cannot
 * approve a mutation that was never offered — so a destructive tool is not merely unusable under
 * `--read-only`, it is absent from `tools/list` entirely.
 */
export function toolsFor(filter: ToolFilter): readonly BuiltTool[] {
  const toolsets = new Set<Toolset>(filter.toolsets)
  return ALL_TOOLS.filter((tool) => {
    if (!toolsets.has(tool.toolset)) return false
    if (filter.readOnly && !tool.annotations.readOnlyHint) return false
    return true
  })
}

export function toolByName(name: string): BuiltTool | undefined {
  return ALL_TOOLS.find((tool) => tool.name === name)
}
