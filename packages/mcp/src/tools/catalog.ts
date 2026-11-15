/**
 * The one hand-written decision this package makes for every operation it
 * exposes: its Kleora-shaped name, which toolset it belongs to, whether it
 * is destructive, and — for the handful that mint a one-time secret — which
 * response field to withhold by default.
 *
 * `catalog.json` is the data; this module only types and validates it, once,
 * at import time, so a typo here is a startup failure and never a silent gap
 * in the tool list.
 *
 * Which tools are destructive and which are secret-gated:
 *
 * - **Secret-gated**: the tools whose response carries a one-time secret
 *   (`kleora_api_key_create`, `kleora_api_key_rotate`,
 *   `kleora_client_rotate_secret`, and `kleora_client_create`, whose
 *   `ClientCreated` response carries a fresh `client_secret` for a
 *   `kind: web` client). A one-time secret returned into a tool result enters
 *   the model's context, and a channel that persists it by design breaks the
 *   promise that it is shown once; so the secret is withheld unless the call
 *   opts in.
 * - **Destructive**: every tool that is irreversible or has a wide blast
 *   radius — deleting an App, erasing a user, and removing or invalidating a
 *   persistent access-granting or credential row (an OAuth client, a role, a
 *   permission, an API key: `kleora_client_delete`, `kleora_role_delete`,
 *   `kleora_permission_delete`, `kleora_api_key_delete`,
 *   `kleora_api_key_revoke`, `kleora_api_key_rotate`).
 */
import rawCatalog from './catalog.json' with { type: 'json' }
import type { Toolset } from '../types.js'
import { OPERATIONS } from '../generated/operations.js'

export interface CatalogEntry {
  readonly operationId: string
  readonly name: string
  readonly toolset: Toolset
  readonly destructive: boolean
  readonly secretField: string | null
}

function validate(entries: readonly CatalogEntry[]): readonly CatalogEntry[] {
  const seenNames = new Set<string>()
  const seenIds = new Set<string>()
  for (const entry of entries) {
    if (!OPERATIONS[entry.operationId]) {
      throw new Error(`catalog.json names unknown operationId '${entry.operationId}'`)
    }
    if (seenIds.has(entry.operationId)) {
      throw new Error(`catalog.json lists operationId '${entry.operationId}' twice`)
    }
    seenIds.add(entry.operationId)
    if (seenNames.has(entry.name)) {
      throw new Error(`catalog.json gives two operations the name '${entry.name}'`)
    }
    seenNames.add(entry.name)
    if (!entry.name.startsWith('kleora_')) {
      throw new Error(`'${entry.name}' does not follow the 'kleora_' naming convention`)
    }
    const operation = OPERATIONS[entry.operationId]
    if (entry.destructive && operation?.method === 'get') {
      throw new Error(`'${entry.name}' is a read (${operation.method.toUpperCase()}) marked destructive`)
    }
  }
  for (const id of Object.keys(OPERATIONS)) {
    if (!seenIds.has(id)) {
      throw new Error(`generated operation '${id}' has no catalog.json entry — add or exclude it`)
    }
  }
  return entries
}

export const CATALOG: readonly CatalogEntry[] = validate(rawCatalog as CatalogEntry[])
