/**
 * How this server is configured. Configuration is the API base URL and a
 * profile name, and nothing else is needed.
 *
 * `--read-only` and the toolset list are the two knobs the tool surface itself
 * offers; everything else here (the issuer, the client id) has a working
 * default, so a person who wants only the base URL and a profile name gets
 * exactly that, and can override the rest for a topology the default cannot
 * describe. The issuer's default is not computed here at all: it is asked of
 * the API (`issuerResolver`, `GET /api/v1/platform`).
 */
import { TOOLSETS, type Toolset } from './types.js'

/** The OAuth client id Kleora registers for this server. */
export const DEFAULT_CLIENT_ID = 'kleora-mcp'

export const DEFAULT_BASE_URL = 'https://api.kleora.io'

export interface Config {
  /** The management API's origin, e.g. `https://api.kleora.io`. */
  baseUrl: string
  /**
   * An explicit issuer — `--issuer` or `KLEORA_MCP_ISSUER` — or `undefined`.
   *
   * The device grant runs at the platform's own issuer. When this is unset the
   * server asks the API for it, `GET {baseUrl}/api/v1/platform`, rather than
   * deriving it from the API's hostname: the hosted API and its issuers share
   * no domain.
   */
  issuer: string | undefined
  /** The MCP server's own OAuth client id (`KLEORA_MCP_CLIENT_ID`). */
  clientId: string
  /**
   * Which stored credential to use. A person running two profiles — say a
   * staging account and a production one — keeps two named credentials
   * rather than one that silently means whichever was authorised last.
   */
  profile: string
  /** `--read-only`: drops every non-read tool from the list, unconditionally. */
  readOnly: boolean
  /** Which groups of tools to offer; all of them by default. */
  toolsets: readonly Toolset[]
}

const ENV_PREFIX = 'KLEORA_MCP_'

/**
 * A host that launches the server from a plugin manifest substitutes the
 * person's settings into `${user_config.*}` placeholders. A field left empty
 * can arrive as `''` or, depending on the host, as the placeholder itself;
 * both mean "not set", so the default applies rather than a literal
 * `${user_config.api_base_url}` being taken for a URL.
 */
const UNFILLED_PLACEHOLDER = /^\$\{user_config\.[A-Za-z0-9_]+\}$/

function env(name: string): string | undefined {
  const value = process.env[`${ENV_PREFIX}${name}`]?.trim()
  if (value === undefined || value === '' || UNFILLED_PLACEHOLDER.test(value)) return undefined
  return value
}

function parseToolsets(value: string | undefined): readonly Toolset[] {
  if (value === undefined) return TOOLSETS
  const names = value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  const unknown = names.filter((name) => !(TOOLSETS as readonly string[]).includes(name))
  if (unknown.length > 0) {
    throw new Error(
      `unknown toolset(s): ${unknown.join(', ')}. Known: ${TOOLSETS.join(', ')} ` +
        `(branding, email, settings, keys and promotion are planned but not built yet).`,
    )
  }
  if (names.length === 0) throw new Error('KLEORA_MCP_TOOLSETS must name at least one toolset')
  return names as Toolset[]
}

export interface ConfigOverrides {
  argv?: readonly string[]
}

/**
 * Reads `process.env` and `argv`, CLI flags winning over the environment.
 * Never reads a credential from either: a token is never an environment
 * variable and never a command-line argument.
 */
export function loadConfig({ argv = [] }: ConfigOverrides = {}): Config {
  const flags = parseArgv(argv)

  const baseUrl = normaliseUrl(flags.get('base-url') ?? env('BASE_URL') ?? DEFAULT_BASE_URL)
  const explicitIssuer = flags.get('issuer') ?? env('ISSUER')
  const issuer = explicitIssuer === undefined ? undefined : normaliseUrl(explicitIssuer)
  const clientId = flags.get('client-id') ?? env('CLIENT_ID') ?? DEFAULT_CLIENT_ID
  const profile = flags.get('profile') ?? env('PROFILE') ?? 'default'
  const readOnly = flags.has('read-only') || env('READ_ONLY') === 'true'
  const toolsets = parseToolsets(flags.get('toolsets') ?? env('TOOLSETS'))

  return { baseUrl, issuer, clientId, profile, readOnly, toolsets }
}

function normaliseUrl(value: string): string {
  // Fails loudly and early rather than as a confusing `TypeError` from deep
  // inside the first request.
  const url = new URL(value)
  return url.toString().replace(/\/$/, '')
}

/** `--read-only`, `--profile=work`, `--profile work` — both spellings. */
function parseArgv(argv: readonly string[]): Map<string, string> {
  const flags = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === undefined || !arg.startsWith('--')) continue
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      flags.set(body.slice(0, eq), body.slice(eq + 1))
      continue
    }
    const next = argv[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      flags.set(body, next)
      i++
    } else {
      flags.set(body, 'true')
    }
  }
  return flags
}
