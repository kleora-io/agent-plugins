/**
 * `kleora-mcp --logout`: end this profile's authorization and remove the
 * credential from this machine.
 *
 * Why the server owns this rather than the plugin that wraps it: the refresh
 * token is written by `@kleora-io/core`'s credential store into the OS
 * keychain or a `0600` file, and the only defensible way to remove it is the
 * code that knows where it went. A plugin uninstall deletes the plugin's own
 * directory and nothing else, so without this the credential would outlive the
 * thing that created it: a long-lived secret nobody can see.
 *
 * Two steps, in this order, and the second runs even if the first fails:
 *
 * 1. **Revoke at the issuer** (RFC 7009). The authorization is a named,
 *    revocable grant; revoking it here is what makes any copy somebody may
 *    already have taken of the file worthless, and it writes one
 *    `refresh_token.revoked` audit event so the account's owner can see the
 *    agent's access end.
 * 2. **Delete locally.** Unconditional: a token we could not revoke (the
 *    machine is offline, or the grant is already gone) is still a token that
 *    must not stay on disk. Leaving it because step 1 failed would be the
 *    worst of both outcomes.
 *
 * Both steps, and the read before them, run holding the profile's credential
 * lock (`CredentialStore.lock`), the same lock every refresh takes. Without it,
 * a running server that is part-way through a refresh could finish after the
 * delete and write its rotated refresh token back into the store, leaving the
 * person signed in. With it, the logout waits for that refresh, then reads and
 * revokes the token the refresh stored.
 */
import type { Config } from './config.js'
import {
  createCredentialStore,
  defaultConfigDir,
  issuerResolver,
  revokeRefreshToken,
  type CredentialStore,
} from '@kleora-io/core'

import { CONFIG_DIR_NAME, KEYCHAIN_SERVICE } from './credentials/where.js'
import { USER_AGENT } from './version.js'

export interface LogoutOutcome {
  /** Whether a credential was stored for this profile at all. */
  hadCredential: boolean
  /** Whether the issuer accepted the revocation. */
  revoked: boolean
  /** Why revocation did not happen, when it did not. Never carries the token. */
  revocationError: string | undefined
  /**
   * Where revocation was attempted: the explicit issuer, or the one the API
   * named (`GET /api/v1/platform`). `undefined` when nothing
   * was stored, or when the issuer itself could not be found.
   */
  issuer: string | undefined
  /** Where the credential was kept, for the message. */
  backend: CredentialStore['backend']
}

export interface LogoutDependencies {
  store?: CredentialStore
  fetch?: typeof globalThis.fetch
}

export async function logout(
  config: Config,
  { store, fetch: fetchImpl = globalThis.fetch }: LogoutDependencies = {},
): Promise<LogoutOutcome> {
  const credentials =
    store ??
    (await createCredentialStore({
      service: KEYCHAIN_SERVICE,
      configDir: defaultConfigDir(CONFIG_DIR_NAME),
    }))
  const run = (): Promise<LogoutOutcome> => revokeAndDelete(config, credentials, fetchImpl)
  // `lock` is optional on the interface; every store `createCredentialStore`
  // returns carries it.
  return credentials.lock === undefined ? run() : credentials.lock(config.profile, run)
}

async function revokeAndDelete(
  config: Config,
  credentials: CredentialStore,
  fetchImpl: typeof globalThis.fetch,
): Promise<LogoutOutcome> {
  const refreshToken = await credentials.get(config.profile)

  if (refreshToken === null) {
    return {
      hadCredential: false,
      revoked: false,
      revocationError: undefined,
      issuer: undefined,
      backend: credentials.backend,
    }
  }

  let revoked = false
  let revocationError: string | undefined
  let issuer: string | undefined
  try {
    // Inside the `try`: an issuer that cannot be found is one more reason the
    // revocation did not happen, never a reason to keep the token on disk.
    issuer = await issuerResolver(config.issuer, {
      baseUrl: config.baseUrl,
      userAgent: USER_AGENT,
      fetch: fetchImpl,
    })()
    await revokeRefreshToken({
      issuer,
      clientId: config.clientId,
      refreshToken,
      userAgent: USER_AGENT,
      fetch: fetchImpl,
    })
    revoked = true
  } catch (error) {
    revocationError = error instanceof Error ? error.message : String(error)
  }

  await credentials.delete(config.profile)

  return { hadCredential: true, revoked, revocationError, issuer, backend: credentials.backend }
}

/**
 * What the person reads. Plain sentences rather than a status code: this is
 * printed by a `/kleora:logout` command whose whole job is to say whether
 * anything is left behind.
 */
export function formatLogoutOutcome(outcome: LogoutOutcome, config: Config): string {
  const where = outcome.backend === 'keychain' ? 'the OS keychain' : '~/.kleora-mcp'

  if (!outcome.hadCredential) {
    return (
      `kleora-mcp: no stored credential for profile '${config.profile}' — nothing to remove.\n` +
      `If an authorization is still listed in the console, revoke it there.`
    )
  }

  if (outcome.revoked) {
    return (
      `kleora-mcp: signed out of profile '${config.profile}'.\n` +
      `The authorization was revoked at ${outcome.issuer ?? 'the issuer'} and the stored credential was ` +
      `deleted from ${where}. Nothing on this machine can reach the account any more.`
    )
  }

  return (
    `kleora-mcp: the stored credential for profile '${config.profile}' was deleted from ` +
    `${where}, but the authorization could not be revoked at ${outcome.issuer ?? 'the issuer'} ` +
    `(${outcome.revocationError ?? 'reason unknown'}).\n` +
    `The grant may still be live: revoke it in the console, beside your other sessions.`
  )
}
