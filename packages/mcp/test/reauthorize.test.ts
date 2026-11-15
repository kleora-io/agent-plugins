/**
 * A logout or a revocation takes effect at the next tool call, and the person
 * can then sign in again, as somebody else if they like.
 *
 * Driven end to end through the real pieces the server wires together — a
 * `Session` from `@kleora-io/core` over a file store in a temporary directory,
 * a `ManagementClient`, and `dispatch` with `reauthorize` bound to
 * `session.invalidate` exactly as `server.ts` binds it — against a fake issuer
 * and a fake management API. Nothing here talks to a network.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileCredentialStore, ManagementClient, Session, SessionNotReady } from '@kleora-io/core'
import type { EnvironmentCache } from '../src/environment-cache.js'
import { toolByName } from '../src/tools/build.js'
import { dispatch } from '../src/tools/dispatch.js'

const ISSUER = 'https://id.example.test'
const API = 'https://api.example.test'
const PROFILE = 'default'

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })
}

/**
 * One fake for both hosts. The issuer rotates refresh tokens and can revoke
 * the whole grant; the API accepts only access tokens minted from a live grant,
 * the way an API that checks revocation does.
 */
function fakeKleora() {
  const state = {
    live: 'refresh-0' as string | null,
    generation: 0,
    liveAccessTokens: new Set<string>(),
    deviceStarts: 0,
    apiCalls: 0,
  }
  const revokeGrant = (): void => {
    state.live = null
    state.liveAccessTokens.clear()
  }
  const fetchImpl = (url: string | URL, init?: RequestInit): Promise<Response> => {
    const target = String(url)
    if (target.startsWith(API)) {
      state.apiCalls++
      const bearer = new Headers(init?.headers).get('Authorization')?.replace(/^Bearer /, '') ?? ''
      if (!state.liveAccessTokens.has(bearer)) {
        return Promise.resolve(
          json(401, { type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'token revoked' }),
        )
      }
      return Promise.resolve(json(200, { principal: { id: 'p-1' }, token: bearer }))
    }
    if (target === `${ISSUER}/oauth/device_authorization`) {
      state.deviceStarts++
      return Promise.resolve(
        json(200, {
          device_code: `device-${String(state.deviceStarts)}`,
          user_code: 'BCDF-GHJK',
          verification_uri: `${ISSUER}/device`,
          expires_in: 600,
          interval: 5,
        }),
      )
    }
    const body = init?.body
    if (!(body instanceof URLSearchParams)) throw new Error(`unexpected request to ${target}`)
    if (body.get('grant_type') !== 'refresh_token') return Promise.resolve(json(400, { error: 'authorization_pending' }))
    if (body.get('refresh_token') !== state.live) {
      revokeGrant()
      return Promise.resolve(json(400, { error: 'invalid_grant' }))
    }
    state.generation++
    state.live = `refresh-${String(state.generation)}`
    const accessToken = `access-${String(state.generation)}`
    state.liveAccessTokens.add(accessToken)
    return Promise.resolve(json(200, { access_token: accessToken, refresh_token: state.live, expires_in: 900 }))
  }
  return { state, revokeGrant, fetch: fetchImpl as typeof globalThis.fetch }
}

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kleora-mcp-reauth-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

async function wire() {
  const kleora = fakeKleora()
  const store = new FileCredentialStore(dir)
  await store.set(PROFILE, 'refresh-0')
  const session = new Session({
    issuer: ISSUER,
    clientId: 'kleora-mcp',
    profile: PROFILE,
    store,
    userAgent: 'kleora-mcp/test',
    fetch: kleora.fetch,
  })
  const client = new ManagementClient({
    baseUrl: API,
    userAgent: 'kleora-mcp/test',
    fetch: kleora.fetch,
    getAccessToken: async () => {
      const state = await session.ensureAccessToken()
      if (state.status === 'ready') return state.accessToken
      throw new SessionNotReady(state)
    },
  })
  const context = {
    client,
    environments: { resolve: () => null, updateFromAppResponse: () => {} } as unknown as EnvironmentCache,
    reauthorize: () => session.invalidate(),
  }
  const whoami = toolByName('kleora_whoami')
  if (!whoami) throw new Error('no kleora_whoami tool')
  const call = async () => {
    const result = await dispatch(whoami, {}, context)
    const content = result.content[0] as { text: string }
    return { isError: result.isError, body: JSON.parse(content.text) as Record<string, unknown> }
  }
  return { kleora, store, call }
}

describe('a revoked authorization', () => {
  it('stops working at the next call, which starts a fresh device sign-in', async () => {
    const { kleora, call } = await wire()

    const first = await call()
    expect(first.isError).toBe(false)
    expect(first.body['token']).toBe('access-1')

    // Revoked in the console: the cached access token has not expired, but
    // the API now refuses it, and the refresh token is dead too.
    kleora.revokeGrant()

    const second = await call()
    expect(second.isError).toBe(false)
    expect(second.body).toMatchObject({ authorization_required: true, reason: 'refresh_rejected' })
    expect(second.body['user_code']).toBe('BCDF-GHJK')
    expect(kleora.state.deviceStarts).toBe(1)
  })

  it('a 401 on a token whose grant is still live is retried once with a fresh one', async () => {
    const { kleora, call } = await wire()
    await call()
    // The API forgets the access token (a key rotation, say) while the
    // refresh token stays valid: one refresh, one retry, and a result.
    kleora.state.liveAccessTokens.clear()

    const result = await call()
    expect(result.isError).toBe(false)
    expect(result.body['token']).toBe('access-2')
    expect(kleora.state.deviceStarts).toBe(0)
  })
})

describe('a logout from another process', () => {
  it('takes effect at the next call even though an access token is cached', async () => {
    const { kleora, store, call } = await wire()
    await call()
    const apiCallsBefore = kleora.state.apiCalls

    // `kleora-mcp --logout` in another process: the stored credential goes.
    await store.delete(PROFILE)

    const result = await call()
    expect(result.body).toMatchObject({ authorization_required: true, reason: 'signed_out' })
    expect(typeof result.body['message']).toBe('string')
    // Refused before it reached the API: the cached token was not used.
    expect(kleora.state.apiCalls).toBe(apiCallsBefore)
    expect(kleora.state.deviceStarts).toBe(1)
  })
})
