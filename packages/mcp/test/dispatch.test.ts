/**
 * How one tool call is validated, dispatched and shaped, driven with a fake `ManagementClient`
 * and a fake `EnvironmentCache`, so nothing here talks to a network.
 */
import { describe, expect, it, vi } from 'vitest'
import { callWithReauthorization, dispatch, notReadyPayload, readMe } from '../src/tools/dispatch.js'
import { toolByName } from '../src/tools/build.js'
import { ApiError, ManagementApiUnreachable, SessionNotReady } from '@kleora-io/core'
import type { ManagementClient } from '@kleora-io/core'
import type { EnvironmentCache } from '../src/environment-cache.js'

function tool(name: string) {
  const found = toolByName(name)
  if (!found) throw new Error(`no such tool: ${name}`)
  return found
}

function fakeContext(call: ManagementClient['call'], resolve?: EnvironmentCache['resolve']) {
  return {
    client: { call } as unknown as ManagementClient,
    environments: {
      resolve: resolve ?? (() => null),
      updateFromAppResponse: () => {},
    } as unknown as EnvironmentCache,
  }
}

function parsed(result: Awaited<ReturnType<typeof dispatch>>): unknown {
  const text = result.content[0]
  if (!text || text.type !== 'text') throw new Error('expected a text content block')
  return JSON.parse(text.text)
}

describe('dispatch', () => {
  it('fails schema validation, before any network call, when environment_id is missing', async () => {
    const call = vi.fn()
    const result = await dispatch(tool('kleora_users_list'), {}, fakeContext(call))

    expect(result.isError).toBe(true)
    expect(call).not.toHaveBeenCalled()
    const body = parsed(result) as { title: string; errors: Array<{ params: { missingProperty: string } }> }
    expect(body.title).toBe('invalid-arguments')
    expect(body.errors[0]?.params.missingProperty).toBe('environment_id')
  })

  it('rejects an unknown argument the same way (additionalProperties: false)', async () => {
    const call = vi.fn()
    const result = await dispatch(
      tool('kleora_environment_read'),
      { environment_id: 'e1', current_environment: 'prod' },
      fakeContext(call),
    )

    expect(result.isError).toBe(true)
    expect(call).not.toHaveBeenCalled()
  })

  it('passes a successful result through unmodified when there is nothing to decorate or redact', async () => {
    const call = vi.fn(() => Promise.resolve({ id: 'u1', email: 'ada@example.com' }))
    const result = await dispatch(tool('kleora_user_read'), { environment_id: 'e1', user_id: 'u1' }, fakeContext(call))

    expect(result.isError ?? false).toBe(false)
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith(expect.anything(), { environment_id: 'e1', user_id: 'u1' })
    expect(parsed(result)).toEqual({ id: 'u1', email: 'ada@example.com' })
  })

  it('makes exactly one HTTP request for a list tool, cursor and all — no tool exhausts a collection', async () => {
    const call = vi.fn(() => Promise.resolve({ items: [{ id: 'u1', environment_id: 'e1' }], next_cursor: 'abc' }))
    const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, fakeContext(call))

    expect(call).toHaveBeenCalledTimes(1)
    const body = parsed(result) as { next_cursor: string }
    expect(body.next_cursor).toBe('abc')
  })

  it('decorates an environment-scoped result with the environment kind and the App slug', async () => {
    const call = vi.fn(() => Promise.resolve({ id: 'u1', environment_id: 'e1' }))
    const resolve = vi.fn(() => Promise.resolve({ kind: 'production', appSlug: 'storefront' }))
    const result = await dispatch(tool('kleora_user_read'), { environment_id: 'e1', user_id: 'u1' }, fakeContext(call, resolve))

    const body = parsed(result) as { _environment: { id: string; kind: string; app_slug: string } }
    expect(body._environment).toEqual({ id: 'e1', kind: 'production', app_slug: 'storefront' })
  })

  it('omits the decoration when the environment cannot be resolved, without failing the call', async () => {
    const call = vi.fn(() => Promise.resolve({ id: 'u1', environment_id: 'e1' }))
    const result = await dispatch(
      tool('kleora_user_read'),
      { environment_id: 'e1', user_id: 'u1' },
      fakeContext(call, () => Promise.resolve(null)),
    )

    expect(result.isError ?? false).toBe(false)
    expect(parsed(result)).not.toHaveProperty('_environment')
  })

  it('passes an RFC 9457 problem document through with type, title, detail and status', async () => {
    const problem = {
      document: { extra: 'field' },
      retryAfter: null,
      requestId: 'req-1',
    }
    const call = vi.fn(() => {
      throw new ApiError('https://kleora.io/problems/insufficient-scope', 403, 'insufficient-scope', 'missing users:write', problem)
    })
    const result = await dispatch(tool('kleora_user_update'), { environment_id: 'e1', user_id: 'u1' }, fakeContext(call))

    expect(result.isError).toBe(true)
    const body = parsed(result) as { type: string; title: string; status: number; detail: string; extra: string }
    expect(body.type).toBe('https://kleora.io/problems/insufficient-scope')
    expect(body.title).toBe('insufficient-scope')
    expect(body.status).toBe(403)
    expect(body.detail).toBe('missing users:write')
    expect(body.extra).toBe('field') // the document's own extra members ride along
  })

  it('distinguishes an unreachable management API from a permission failure', async () => {
    const call = vi.fn(() => {
      throw new ManagementApiUnreachable('could not reach https://api.example')
    })
    const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, fakeContext(call))

    expect(result.isError).toBe(true)
    const body = parsed(result) as { title: string; status?: number }
    expect(body.title).toBe('management-api-unreachable')
    expect(body.status).toBeUndefined() // never mistaken for the API's own 4xx/5xx
  })

  it('surfaces "not authorised yet" as a normal result, not an error', async () => {
    const call = vi.fn(() => {
      throw new SessionNotReady({
        status: 'authorization_required',
        verificationUri: 'https://id.example/flow/device',
        verificationUriComplete: 'https://id.example/flow/device?user_code=ABCD-EFGH',
        userCode: 'ABCD-EFGH',
        message: 'Sign in to authorise this tool.',
        reason: 'no_credential',
      })
    })
    const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, fakeContext(call))

    expect(result.isError ?? false).toBe(false)
    const body = parsed(result) as { authorization_required: boolean; user_code: string }
    expect(body.authorization_required).toBe(true)
    expect(body.user_code).toBe('ABCD-EFGH')
  })

  it.each(['no_credential', 'refresh_rejected', 'signed_out'] as const)(
    'says why a sign-in is needed (%s), with the message beside it',
    async (reason) => {
      const message = `Why: ${reason}. Open the verification URL, enter the code, and approve.`
      const call = vi.fn(() => {
        throw new SessionNotReady({
          status: 'authorization_required',
          verificationUri: 'https://id.example/flow/device',
          verificationUriComplete: 'https://id.example/flow/device?user_code=ABCD-EFGH',
          userCode: 'ABCD-EFGH',
          message,
          reason,
        })
      })
      const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, fakeContext(call))

      expect(result.isError ?? false).toBe(false)
      expect(parsed(result)).toMatchObject({ authorization_required: true, reason, message })
    },
  )

  it('surfaces a denied authorization as an error', async () => {
    const call = vi.fn(() => {
      throw new SessionNotReady({ status: 'denied' })
    })
    const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, fakeContext(call))

    expect(result.isError).toBe(true)
    const body = parsed(result) as { title: string }
    expect(body.title).toBe('access_denied')
  })

  describe('secret-minting tools', () => {
    it('withholds the secret by default, but keeps id, prefix and metadata', async () => {
      const call = vi.fn(() => Promise.resolve({ id: 'k1', prefix: 'kl_live_ab', key: 'kl_live_abcdefgh', environment_id: 'e1' }))
      const result = await dispatch(
        tool('kleora_api_key_create'),
        { environment_id: 'e1', name: 'CI key', scopes: ['users:read'] },
        fakeContext(call),
      )

      const body = parsed(result) as Record<string, unknown>
      expect(body['key']).toBeUndefined()
      expect(body['id']).toBe('k1')
      expect(body['prefix']).toBe('kl_live_ab')
      expect(body['secret_returned']).toBe(false)
      expect(typeof body['secret_note']).toBe('string')
    })

    it('returns the secret exactly when return_secret is true', async () => {
      const call = vi.fn(() => Promise.resolve({ id: 'k1', prefix: 'kl_live_ab', key: 'kl_live_abcdefgh', environment_id: 'e1' }))
      const result = await dispatch(
        tool('kleora_api_key_create'),
        { environment_id: 'e1', name: 'CI key', scopes: ['users:read'], return_secret: true },
        fakeContext(call),
      )

      const body = parsed(result) as Record<string, unknown>
      expect(body['key']).toBe('kl_live_abcdefgh')
      expect(body['secret_returned']).toBe(true)
      // `return_secret` itself is a tool-facing switch, not an API field —
      // it must never leak into the request the client actually sends.
      expect(call).toHaveBeenCalledWith(expect.anything(), expect.not.objectContaining({ return_secret: true }))
    })

    it.each([
      ['kleora_client_create', 'client_secret', 'kleora_client_rotate_secret', { environment_id: 'e1', name: 'Web', kind: 'web' }],
      ['kleora_api_key_create', 'key', 'kleora_api_key_rotate', { environment_id: 'e1', name: 'CI key', scopes: ['users:read'] }],
    ])('tells an agent not to call %s again, and names the rotate tool instead', async (name, field, rotate, args) => {
      const call = vi.fn(() => Promise.resolve({ id: 'x1', [field]: 'secret-value', environment_id: 'e1' }))
      const result = await dispatch(tool(name), args, fakeContext(call))

      const note = (parsed(result) as Record<string, unknown>)['secret_note'] as string
      expect(note).toContain(`Do not call ${name} again`)
      expect(note).toContain(`call ${rotate} with return_secret: true`)
      expect(note).not.toContain('Call this tool again')
    })

    it.each([
      ['kleora_client_rotate_secret', 'client_secret', { environment_id: 'e1', client_id: 'x1' }],
      ['kleora_api_key_rotate', 'key', { environment_id: 'e1', api_key_id: 'x1' }],
    ])('tells an agent that calling %s again rotates again', async (name, field, args) => {
      const call = vi.fn(() => Promise.resolve({ id: 'x1', [field]: 'secret-value', environment_id: 'e1' }))
      const result = await dispatch(tool(name), args, fakeContext(call))

      const note = (parsed(result) as Record<string, unknown>)['secret_note'] as string
      expect(note).toContain(`Calling ${name} again with return_secret: true rotates again`)
    })

    it('never gates a secret on a tool the catalog does not mark secret-gated', async () => {
      const call = vi.fn(() => Promise.resolve({ id: 'u1', environment_id: 'e1' }))
      const result = await dispatch(tool('kleora_user_read'), { environment_id: 'e1', user_id: 'u1' }, fakeContext(call))
      const body = parsed(result) as Record<string, unknown>
      expect(body['secret_returned']).toBeUndefined()
    })
  })

  describe('a 401 from the API', () => {
    function unauthorized(): ApiError {
      return new ApiError('about:blank', 401, 'Unauthorized', 'token revoked', {
        document: {},
        retryAfter: null,
        requestId: undefined,
      })
    }

    it('drops the cached token and retries once, returning the retried result', async () => {
      const call = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(unauthorized()))
        .mockImplementationOnce(() => Promise.resolve({ items: [], next_cursor: null }))
      const reauthorize = vi.fn()
      const context = { ...fakeContext(call), reauthorize }

      const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, context)

      expect(reauthorize).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(2)
      expect(result.isError).toBe(false)
      expect(parsed(result)).toEqual({ items: [], next_cursor: null })
    })

    it('surfaces the sign-in the retry asks for, with its reason', async () => {
      const call = vi
        .fn()
        .mockImplementationOnce(() => Promise.reject(unauthorized()))
        .mockImplementationOnce(() =>
          Promise.reject(
            new SessionNotReady({
              status: 'authorization_required',
              verificationUri: 'https://id.example/flow/device',
              verificationUriComplete: 'https://id.example/flow/device?user_code=ABCD-EFGH',
              userCode: 'ABCD-EFGH',
              message: 'The stored sign-in was refused.',
              reason: 'refresh_rejected',
            }),
          ),
        )
      const context = { ...fakeContext(call), reauthorize: vi.fn() }

      const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, context)

      expect(result.isError ?? false).toBe(false)
      expect(parsed(result)).toMatchObject({ authorization_required: true, reason: 'refresh_rejected' })
    })

    it('retries only once: a second 401 is passed through as the problem it is', async () => {
      const call = vi.fn(() => Promise.reject(unauthorized()))
      const reauthorize = vi.fn()
      const context = { ...fakeContext(call), reauthorize }

      const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, context)

      expect(reauthorize).toHaveBeenCalledTimes(1)
      expect(call).toHaveBeenCalledTimes(2)
      expect(result.isError).toBe(true)
      expect(parsed(result)).toMatchObject({ status: 401 })
    })

    it('does not retry any other status', async () => {
      const call = vi.fn(() =>
        Promise.reject(
          new ApiError('about:blank', 403, 'Forbidden', 'no', { document: {}, retryAfter: null, requestId: undefined }),
        ),
      )
      const reauthorize = vi.fn()

      const result = await dispatch(tool('kleora_users_list'), { environment_id: 'e1' }, { ...fakeContext(call), reauthorize })

      expect(reauthorize).not.toHaveBeenCalled()
      expect(call).toHaveBeenCalledTimes(1)
      expect(result.isError).toBe(true)
    })
  })
})

describe('the kleora://me resource', () => {
  const notReady = (reason: 'no_credential' | 'refresh_rejected' | 'signed_out') =>
    new SessionNotReady({
      status: 'authorization_required',
      verificationUri: 'https://id.example/flow/device',
      verificationUriComplete: 'https://id.example/flow/device?user_code=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
      message: `Sign in (${reason}).`,
      reason,
    })
  const unauthorized = () =>
    new ApiError('about:blank', 401, 'Unauthorized', 'token revoked', {
      document: {},
      retryAfter: null,
      requestId: undefined,
    })

  it('is GET /me when signed in', async () => {
    const call = vi.fn(() => Promise.resolve({ principal: { id: 'p-1' } }))
    expect(await readMe({ client: { call } as unknown as ManagementClient })).toEqual({ principal: { id: 'p-1' } })
    expect((call.mock.calls[0] as unknown[])[0]).toMatchObject({ operationId: 'me', path: '/api/v1/me' })
  })

  it('is the sign-in, with its reason, when there is none', async () => {
    const call = vi.fn(() => Promise.reject(notReady('signed_out')))
    expect(await readMe({ client: { call } as unknown as ManagementClient })).toMatchObject({
      authorization_required: true,
      reason: 'signed_out',
      message: 'Sign in (signed_out).',
    })
  })

  it('retries once after a 401, and reports the sign-in the retry asks for', async () => {
    const call = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(unauthorized()))
      .mockImplementationOnce(() => Promise.reject(notReady('refresh_rejected')))
    const reauthorize = vi.fn()
    const me = await readMe({ client: { call } as unknown as ManagementClient, reauthorize })
    expect(reauthorize).toHaveBeenCalledTimes(1)
    expect(me).toMatchObject({ authorization_required: true, reason: 'refresh_rejected' })
  })

  it('reports any other failure as an error, never as a sign-in', async () => {
    const call = vi.fn(() => Promise.reject(new ManagementApiUnreachable('could not reach https://api.example')))
    const reauthorize = vi.fn()
    const me = await readMe({ client: { call } as unknown as ManagementClient, reauthorize })
    expect(reauthorize).not.toHaveBeenCalled()
    expect(me).toEqual({ error: expect.stringContaining('could not reach') as unknown })
  })
})

describe('callWithReauthorization', () => {
  it('passes a 401 straight through when there is nothing to reauthorise with', async () => {
    const call = vi.fn(() =>
      Promise.reject(new ApiError('about:blank', 401, 'Unauthorized', 'no', { document: {}, retryAfter: null, requestId: undefined })),
    )
    await expect(
      callWithReauthorization({ client: { call } as unknown as ManagementClient }, tool('kleora_whoami').operation, {}),
    ).rejects.toBeInstanceOf(ApiError)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the session itself is not ready', async () => {
    const call = vi.fn(() => Promise.reject(new SessionNotReady({ status: 'denied' })))
    const reauthorize = vi.fn()
    await expect(
      callWithReauthorization({ client: { call } as unknown as ManagementClient, reauthorize }, tool('kleora_whoami').operation, {}),
    ).rejects.toBeInstanceOf(SessionNotReady)
    expect(reauthorize).not.toHaveBeenCalled()
  })
})

describe('the sign-in payload', () => {
  it('never carries the device code, only what the person needs', () => {
    const payload = notReadyPayload({
      status: 'authorization_required',
      verificationUri: 'https://id.example/flow/device',
      verificationUriComplete: 'https://id.example/flow/device?user_code=ABCD-EFGH',
      userCode: 'ABCD-EFGH',
      message: 'Sign in.',
      reason: 'no_credential',
    })
    expect(Object.keys(payload).sort()).toEqual([
      'authorization_required',
      'message',
      'reason',
      'user_code',
      'verification_uri',
      'verification_uri_complete',
    ])
  })
})
