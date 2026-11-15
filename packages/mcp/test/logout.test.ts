/**
 * `--logout` (uninstalling must leave no live credential behind), driven
 * against a fake issuer and an in-memory store.
 *
 * The property worth protecting is the order and the unconditionality: revoke
 * first so a copy of the token is worthless, then delete locally **whatever
 * happened** — a token that could not be revoked is still a token that must
 * not stay on disk.
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from '../src/config.js'
import { FileCredentialStore, type CredentialStore } from '@kleora-io/core'
import { formatLogoutOutcome, logout } from '../src/logout.js'

class MemoryStore implements CredentialStore {
  readonly backend = 'file' as const
  #values = new Map<string, string>()

  constructor(entries: Record<string, string> = {}) {
    for (const [profile, token] of Object.entries(entries)) this.#values.set(profile, token)
  }

  get(profile: string): Promise<string | null> {
    return Promise.resolve(this.#values.get(profile) ?? null)
  }
  set(profile: string, refreshToken: string): Promise<void> {
    this.#values.set(profile, refreshToken)
    return Promise.resolve()
  }
  delete(profile: string): Promise<void> {
    this.#values.delete(profile)
    return Promise.resolve()
  }
  has(profile: string): boolean {
    return this.#values.has(profile)
  }
}

const CONFIG: Config = {
  baseUrl: 'https://api.example.test',
  issuer: 'https://id.example.test',
  clientId: 'kleora-mcp',
  profile: 'default',
  readOnly: false,
  toolsets: ['core'],
}

describe('logout', () => {
  it('revokes the refresh token at the issuer and then deletes it locally', async () => {
    const store = new MemoryStore({ default: 'refresh-token-1' })
    const fetchMock = vi.fn((url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe(`${CONFIG.issuer}/oauth/revoke`)
      const body = init?.body as URLSearchParams | undefined
      expect(body).toBeInstanceOf(URLSearchParams)
      expect(body!.get('token')).toBe('refresh-token-1')
      expect(body!.get('token_type_hint')).toBe('refresh_token')
      expect(body!.get('client_id')).toBe('kleora-mcp')
      return Promise.resolve(new Response('', { status: 200 }))
    })

    const outcome = await logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome).toMatchObject({ hadCredential: true, revoked: true, revocationError: undefined })
    expect(store.has('default')).toBe(false)
    expect(formatLogoutOutcome(outcome, CONFIG)).toContain('revoked')
  })

  it('deletes the credential even when the issuer cannot be reached, and says the grant may be live', async () => {
    const store = new MemoryStore({ default: 'refresh-token-1' })
    const fetchMock = vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED')))

    const outcome = await logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch })

    expect(outcome.hadCredential).toBe(true)
    expect(outcome.revoked).toBe(false)
    expect(store.has('default')).toBe(false)

    const message = formatLogoutOutcome(outcome, CONFIG)
    expect(message).toContain('may still be live')
    expect(message).toContain('console')
    // Never the token itself, in any branch.
    expect(message).not.toContain('refresh-token-1')
  })

  it('with no explicit issuer, revokes at the one the API names ', async () => {
    const store = new MemoryStore({ default: 'refresh-token-1' })
    const seen: string[] = []
    const fetchMock = vi.fn((url: string | URL) => {
      seen.push(String(url))
      if (String(url).endsWith('/api/v1/platform')) {
        return Promise.resolve(Response.json({ issuer: 'https://login.elsewhere.test' }))
      }
      return Promise.resolve(new Response('', { status: 200 }))
    })

    const outcome = await logout(
      { ...CONFIG, issuer: undefined },
      { store, fetch: fetchMock as unknown as typeof fetch },
    )

    expect(seen).toEqual([
      `${CONFIG.baseUrl}/api/v1/platform`,
      'https://login.elsewhere.test/oauth/revoke',
    ])
    expect(outcome).toMatchObject({ revoked: true, issuer: 'https://login.elsewhere.test' })
    expect(formatLogoutOutcome(outcome, CONFIG)).toContain('https://login.elsewhere.test')
  })

  it('deletes the credential even when the issuer cannot be found', async () => {
    const store = new MemoryStore({ default: 'refresh-token-1' })
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 404 })))

    const outcome = await logout(
      { ...CONFIG, issuer: undefined },
      { store, fetch: fetchMock as unknown as typeof fetch },
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(outcome).toMatchObject({ hadCredential: true, revoked: false, issuer: undefined })
    expect(store.has('default')).toBe(false)
    expect(formatLogoutOutcome(outcome, CONFIG)).toContain('may still be live')
  })

  it('touches only the profile it was asked about', async () => {
    const store = new MemoryStore({ default: 'token-a', work: 'token-b' })
    const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 200 })))

    await logout({ ...CONFIG, profile: 'work' }, { store, fetch: fetchMock as unknown as typeof fetch })

    expect(store.has('work')).toBe(false)
    expect(store.has('default')).toBe(true)
  })

  it('with nothing stored, reports that and makes no request', async () => {
    const store = new MemoryStore()
    const fetchMock = vi.fn(() => Promise.reject(new Error('should not be called')))

    const outcome = await logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(outcome).toMatchObject({ hadCredential: false, revoked: false })
    expect(formatLogoutOutcome(outcome, CONFIG)).toContain('nothing to remove')
  })

  describe('holding the credential lock', () => {
    let dir: string
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), 'kleora-mcp-logout-'))
    })
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true })
    })

    it('waits for a refresh in flight, then revokes and deletes the token it stored', async () => {
      // A running server is part-way through a refresh: it holds the lock and
      // has not yet written the rotated token. A logout started now must not
      // read or delete until the refresh is done, or the refresh would write
      // its token back afterwards and the person would still be signed in.
      const store = new FileCredentialStore(dir)
      await store.set('default', 'refresh-token-1')
      const revoked: string[] = []
      const fetchMock = vi.fn((_url: string | URL, init?: RequestInit) => {
        revoked.push((init?.body as URLSearchParams).get('token') ?? '')
        return Promise.resolve(new Response('', { status: 200 }))
      })

      let release!: () => void
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      let refreshHolding!: () => void
      const holding = new Promise<void>((resolve) => {
        refreshHolding = resolve
      })
      const refresh = store.lock('default', async () => {
        refreshHolding()
        await released
        await store.set('default', 'refresh-token-2') // the rotated token
      })
      await holding

      let finished = false
      const loggingOut = logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch }).then((outcome) => {
        finished = true
        return outcome
      })

      // Give the logout every chance to run ahead of the lock.
      await new Promise((resolve) => setTimeout(resolve, 200))
      expect(finished).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(await store.get('default')).toBe('refresh-token-1')

      release()
      await refresh
      const outcome = await loggingOut

      expect(outcome).toMatchObject({ hadCredential: true, revoked: true })
      expect(revoked).toEqual(['refresh-token-2'])
      expect(await store.get('default')).toBeNull()
    })

    it('still deletes locally when the revocation fails', async () => {
      const store = new FileCredentialStore(dir)
      await store.set('default', 'refresh-token-1')
      const fetchMock = vi.fn(() => Promise.reject(new Error('connect ECONNREFUSED')))

      const outcome = await logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch })

      expect(outcome).toMatchObject({ hadCredential: true, revoked: false })
      expect(await store.get('default')).toBeNull()
    })

    it('takes the lock for the profile it was asked about', async () => {
      const store = new FileCredentialStore(dir)
      await store.set('default', 'refresh-token-1')
      const locked: string[] = []
      const lock = store.lock.bind(store)
      store.lock = <T>(profile: string, fn: () => Promise<T>): Promise<T> => {
        locked.push(profile)
        return lock(profile, fn)
      }
      const fetchMock = vi.fn(() => Promise.resolve(new Response('', { status: 200 })))

      await logout(CONFIG, { store, fetch: fetchMock as unknown as typeof fetch })

      expect(locked).toEqual(['default'])
    })
  })
})
