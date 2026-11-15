/**
 * Runs one `tools/call`: validates arguments against the tool's own JSON
 * Schema, calls the management API, and shapes the result. Results are the
 * management API's own response bodies, unmodified, except for two things:
 * the secret redaction and the environment decoration.
 */
import Ajv, { type ValidateFunction } from 'ajv'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { BuiltTool } from './build.js'
import { ApiError, ManagementApiUnreachable, SessionNotReady, type NotReadyState } from '@kleora-io/core'
import type { ManagementClient, Operation, OperationArgs } from '@kleora-io/core'
import type { EnvironmentCache } from '../environment-cache.js'
import { OPERATIONS } from '../generated/operations.js'

export type { CallToolResult }

// `strict: false` because the generated schemas carry OpenAPI-authored
// keywords (`format: "uuid"`, `title`, …) ajv-core does not itself validate;
// `logger: false` because an unknown `format` would otherwise warn on
// *every* compile, and this server's stderr is where operational stdio
// framing problems need to stand out, not schema-generation noise.
const ajv = new Ajv({ strict: false, allErrors: true, logger: false })
const validators = new Map<string, ValidateFunction>()

function validatorFor(tool: BuiltTool): ValidateFunction {
  let validator = validators.get(tool.name)
  if (!validator) {
    validator = ajv.compile(tool.inputSchema)
    validators.set(tool.name, validator)
  }
  return validator
}

function textResult(value: unknown, isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
    isError,
  }
}

export interface DispatchContext {
  client: ManagementClient
  environments: EnvironmentCache
  /**
   * Drops the access token cached in memory, so the next call re-reads the
   * stored credential (`Session.invalidate`). Called once when the API
   * answers `401`; see `callWithReauthorization`.
   */
  reauthorize?: () => void
}

/**
 * Calls the API, and on a `401` drops the cached access token and tries once
 * more.
 *
 * A `401` on a token that has not expired means the authorization behind it
 * ended early: a logout in another process, or a revocation in the console.
 * The retry asks the session for a token again, which re-reads the store and
 * refreshes. If the refresh token was revoked too, the issuer refuses it and
 * the session starts a fresh device sign-in, which reaches the caller as
 * `SessionNotReady` (reason `refresh_rejected` or `signed_out`). That is also
 * what lets a person sign in as somebody else after a logout.
 *
 * Retrying is safe for every method, writes included: a `401` is refused
 * before the request is acted on. Only one retry, so a server that answers
 * `401` to every token cannot cause a loop.
 */
export async function callWithReauthorization(
  context: Pick<DispatchContext, 'client' | 'reauthorize'>,
  operation: Operation,
  args: OperationArgs,
): Promise<unknown> {
  try {
    return await context.client.call(operation, args)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || context.reauthorize === undefined) throw error
    context.reauthorize()
    return context.client.call(operation, args)
  }
}

/**
 * An environment-scoped tool called without `environment_id` fails schema
 * validation; there is no default and no remembered value between calls.
 * This is where that validation runs — against the exact
 * schema the operation's own OpenAPI document requires, so a missing
 * `environment_id` fails here before any network call, for every operation
 * whose path names one.
 */
export async function dispatch(
  tool: BuiltTool,
  rawArgs: Record<string, unknown> | undefined,
  context: DispatchContext,
): Promise<CallToolResult> {
  const args = rawArgs ?? {}
  const validate = validatorFor(tool)
  if (!validate(args)) {
    return textResult(
      {
        type: 'about:blank',
        title: 'invalid-arguments',
        status: 400,
        detail: `'${tool.name}' was called with arguments that do not match its schema.`,
        errors: validate.errors,
      },
      true,
    )
  }

  const { return_secret: returnSecret, ...callArgs } = args as Record<string, unknown> & {
    return_secret?: boolean
  }

  let result: unknown
  try {
    result = await callWithReauthorization(context, tool.operation, callArgs)
  } catch (error) {
    if (error instanceof SessionNotReady) return notReadyResult(error.state)
    if (error instanceof ApiError) {
      // Errors are the RFC 9457 problem document, passed through with its
      // `type`, `title`, `detail` and `status`, verbatim, so an agent that gets
      // `403 insufficient-scope` can tell the person what to ask for.
      return textResult(error.toProblemDocument(), true)
    }
    if (error instanceof ManagementApiUnreachable) {
      // Distinguishable from a permission failure: no `status`, no `type`
      // naming a permission, just the plain fact that
      // nothing was reachable.
      return textResult(
        { type: 'about:blank', title: 'management-api-unreachable', detail: error.message },
        true,
      )
    }
    throw error
  }

  const shaped = shapeResult(tool, result, returnSecret === true, context)
  return textResult(await shaped)
}

async function shapeResult(
  tool: BuiltTool,
  result: unknown,
  returnSecret: boolean,
  context: DispatchContext,
): Promise<unknown> {
  let shaped = result

  if (tool.secretField !== null) {
    shaped = redactSecret(shaped, tool.name, tool.secretField, returnSecret)
  }

  const decoration = await decorateEnvironment(shaped, context)
  if (decoration !== null && shaped !== null && typeof shaped === 'object') {
    shaped = { ...(shaped as Record<string, unknown>), _environment: decoration }
  }

  // Keeps the app-slug cache correct the moment a rename goes through this
  // very server, rather than waiting for it to go stale (environment-cache.ts).
  if (tool.operation.tag === 'apps') context.environments.updateFromAppResponse(result)

  return shaped
}

/**
 * The rotate tool that mints a fresh secret for what a create tool made. A
 * create cannot simply be called again for its secret — that makes a second
 * client or key and leaves the first one orphaned — so the note for a create
 * names the way that does work.
 */
const ROTATE_FOR_CREATE: Readonly<Record<string, string>> = {
  kleora_client_create: 'kleora_client_rotate_secret',
  kleora_api_key_create: 'kleora_api_key_rotate',
}

function withheldNote(toolName: string, field: string): string {
  const rotate = ROTATE_FOR_CREATE[toolName]
  if (rotate !== undefined) {
    return (
      `The ${field} was not returned and cannot be retrieved later. Do not call ${toolName} again for it: ` +
      `that creates a second one. To get a usable secret, call ${rotate} with return_secret: true, ` +
      'which replaces the secret and shows the new one once.'
    )
  }
  return (
    `The ${field} was not returned. Calling ${toolName} again with return_secret: true ` +
    'rotates again and shows the new secret once; it cannot be retrieved afterwards.'
  )
}

function redactSecret(result: unknown, toolName: string, field: string, returnSecret: boolean): unknown {
  if (typeof result !== 'object' || result === null || !(field in result)) return result
  const record = result as Record<string, unknown>
  if (returnSecret) return { ...record, secret_returned: true }
  const rest = Object.fromEntries(Object.entries(record).filter(([key]) => key !== field))
  return { ...rest, secret_returned: false, secret_note: withheldNote(toolName, field) }
}

async function decorateEnvironment(
  result: unknown,
  context: DispatchContext,
): Promise<{ id: string; kind: string; app_slug: string | null } | null> {
  const environmentId = environmentIdOf(result)
  if (environmentId === null) return null
  const info = await context.environments.resolve(context.client, environmentId)
  if (info === null) return null
  return { id: environmentId, kind: info.kind, app_slug: info.appSlug }
}

function environmentIdOf(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null
  const record = result as Record<string, unknown>
  if (typeof record['environment_id'] === 'string') return record['environment_id']
  const items = record['items']
  if (Array.isArray(items) && items.length > 0) {
    const first = items[0] as Record<string, unknown> | undefined
    if (first && typeof first['environment_id'] === 'string') return first['environment_id']
  }
  return null
}

/**
 * With no usable credential for the profile, the tool result is the
 * verification URI, the user code and instructions. It is not an error: this
 * is the sign-in. When the person denies the device approval, the result is
 * `access_denied`, surfaced plainly. Shared with the `kleora://me` resource
 * handler, which hits the same states through the same `getAccessToken`
 * callback.
 */
export function notReadyResult(state: NotReadyState): CallToolResult {
  return textResult(notReadyPayload(state), state.status === 'denied')
}

/**
 * The body of the `kleora://me` resource: `GET /me` (principal, account,
 * memberships and permissions), or, when there is no usable sign-in, the same
 * sign-in instructions a tool call returns, `reason` included. A `401` gets
 * the same one retry a tool call does.
 */
export async function readMe(context: Pick<DispatchContext, 'client' | 'reauthorize'>): Promise<unknown> {
  try {
    return await callWithReauthorization(context, ME, {})
  } catch (error) {
    if (error instanceof SessionNotReady) return notReadyPayload(error.state)
    return { error: String(error) }
  }
}

const ME = (() => {
  const found = OPERATIONS['me']
  if (!found) throw new Error("invariant: generated operations has no 'me'")
  return found
})()

/** The plain object `notReadyResult` wraps as text — also used by the `kleora://me` resource. */
export function notReadyPayload(state: NotReadyState): Record<string, unknown> {
  if (state.status === 'denied') {
    return { type: 'about:blank', title: 'access_denied', detail: 'The device authorization was denied.' }
  }
  return {
    authorization_required: true,
    // Why a sign-in is needed: `no_credential` (nothing stored for this
    // profile), `refresh_rejected` (the issuer refused the stored token, so it
    // was revoked, expired or replayed), or `signed_out` (the credential was
    // removed while this server was using it, e.g. by `--logout`). `message`
    // says the same in a sentence the agent can pass on.
    reason: state.reason,
    verification_uri: state.verificationUri,
    verification_uri_complete: state.verificationUriComplete,
    user_code: state.userCode,
    message: state.message,
  }
}
