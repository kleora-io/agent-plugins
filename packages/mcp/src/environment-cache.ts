/**
 * Resolves an `environment_id` to `{ kind, appSlug }` so every environment-
 * scoped result can carry them. Environments are never implicit: every result
 * from an environment-scoped tool carries that environment's `kind` and the
 * App's slug, so an approval dialog and a transcript both show what was
 * actually touched.
 *
 * A response only ever carries `environment_id` (a UUID) — `kind` lives on
 * the Environment and the slug on its App, one hop further. Resolving both on
 * every call would double or triple this server's request count, so the
 * answer is cached for the life of the process: an App's slug and an
 * Environment's kind are for-practical-purposes immutable for the duration of
 * one conversation, and a rename made *through this same server* updates the
 * cache immediately (`updateFromAppResponse`) rather than waiting to go
 * stale.
 *
 * Best-effort throughout: a caller who can touch a resource in an
 * environment is not guaranteed `apps:read` on its App (a tenant-scoped
 * principal, for instance), so a failed lookup here never fails the tool
 * call it was decorating — the primary result is correct on its own; the
 * decoration is additive.
 */
import type { ManagementClient } from '@kleora-io/core'
import { OPERATIONS } from './generated/operations.js'

export interface EnvironmentInfo {
  kind: string
  appSlug: string | null
}

interface EnvironmentRow {
  kind: string
  appId: string
}

export class EnvironmentCache {
  #environments = new Map<string, EnvironmentRow>()
  #appSlugs = new Map<string, string>()

  async resolve(client: ManagementClient, environmentId: string): Promise<EnvironmentInfo | null> {
    try {
      const environment = await this.#environment(client, environmentId)
      const appSlug = await this.#appSlug(client, environment.appId)
      return { kind: environment.kind, appSlug }
    } catch {
      return null
    }
  }

  /** Keeps the slug cache correct after a rename made through this server. */
  updateFromAppResponse(response: unknown): void {
    if (
      typeof response === 'object' &&
      response !== null &&
      'id' in response &&
      'slug' in response &&
      typeof (response as { id: unknown }).id === 'string' &&
      typeof (response as { slug: unknown }).slug === 'string'
    ) {
      this.#appSlugs.set((response as { id: string }).id, (response as { slug: string }).slug)
    }
  }

  async #environment(client: ManagementClient, environmentId: string): Promise<EnvironmentRow> {
    const cached = this.#environments.get(environmentId)
    if (cached) return cached
    const response = (await client.call(READ_ENVIRONMENT, { environment_id: environmentId })) as {
      kind: string
      app_id: string
    }
    const row: EnvironmentRow = { kind: response.kind, appId: response.app_id }
    this.#environments.set(environmentId, row)
    return row
  }

  async #appSlug(client: ManagementClient, appId: string): Promise<string | null> {
    const cached = this.#appSlugs.get(appId)
    if (cached) return cached
    const response = (await client.call(READ_APP, { app_id: appId })) as { slug: string }
    this.#appSlugs.set(appId, response.slug)
    return response.slug
  }
}

// Both are already generated operations behind the `core` toolset's own
// `kleora_environment_read` and `kleora_app_read` tools — reused here
// rather than re-described, so there is exactly one definition of what these
// two calls look like.
function operation(id: string): (typeof OPERATIONS)[string] {
  const found = OPERATIONS[id]
  if (!found) throw new Error(`invariant: generated operations has no '${id}'`)
  return found
}

const READ_ENVIRONMENT = operation('read_environment')
const READ_APP = operation('read_app')
