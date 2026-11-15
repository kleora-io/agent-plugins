/**
 * Regenerate each tool's input schema from the management API's OpenAPI
 * document, as Kleora's deployment serves it.
 *
 *   pnpm generate:tools              # fetch the deployed document, then generate
 *   pnpm generate:tools --offline    # regenerate from the committed copy only
 *
 * Fetches https://api.kleora.io/api/v1/openapi.json (`MANAGEMENT_OPENAPI_URL`
 * overrides it) and writes two files, both committed:
 *
 * - `openapi/management-v1.json` at the repository root: the document itself,
 *   with object keys sorted so the file changes only when the API does, and so
 *   the input the tools were generated from is reviewable in the diff that
 *   changed it;
 * - `packages/mcp/src/generated/operations.ts`: the operations below.
 *
 * CI runs this and fails when either file differs from what is committed, so a
 * change to the deployed API surfaces as a red check rather than as a tool
 * whose schema silently disagrees with the server. `--offline` skips the fetch
 * and reads the committed document: for editing `src/tools/catalog.json`
 * without a network.
 *
 * The design is one tool per operation: a tool's input schema is the
 * operation's own path, query and request-body schema, never a hand-maintained
 * copy that drifts.
 *
 * What it produces, per selected operation: the HTTP method and path
 * template, which top-level argument names are path parameters and which are
 * query parameters (everything else is a body field), and a self-contained
 * JSON Schema — `$ref`s resolved into a local `$defs` object, so the schema
 * validates on its own with no access to the wider document. `src/tools/`
 * is what gives each operation a Kleora-shaped name, a toolset and its
 * destructive/secret annotations; nothing here invents those, and nothing
 * here decides which operations exist as tools at all — that list is
 * `src/tools/catalog.json`, hand-written, and this script only emits schemas
 * for the operation ids that file names.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const MANAGEMENT_URL = 'https://api.kleora.io/api/v1/openapi.json'
const url = process.env.MANAGEMENT_OPENAPI_URL || MANAGEMENT_URL
const offline = process.argv.includes('--offline')

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')
const documentPath = resolve(repoRoot, 'openapi/management-v1.json')
const catalogPath = resolve(here, '../src/tools/catalog.json')
const outputPath = resolve(here, '../src/generated/operations.ts')

// Object keys sorted, array order kept: the committed document then changes
// only when the API does, never because the server serialised a mapping in a
// different order.
const sorted = (value) =>
  Array.isArray(value)
    ? value.map(sorted)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, sorted(value[key])]),
        )
      : value

async function fetchDocument() {
  // An explicit User-Agent: the deployment sits behind a CDN that refuses
  // requests carrying a generic library default.
  const response = await globalThis.fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'kleora-mcp-generator (+https://github.com/kleora-io/agent-plugins)',
    },
  })
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`)
  const fetched = sorted(await response.json())
  mkdirSync(dirname(documentPath), { recursive: true })
  writeFileSync(documentPath, JSON.stringify(fetched, null, 2) + '\n', 'utf8')
  console.log(`wrote ${relative(repoRoot, documentPath)} from ${url}`)
  return fetched
}

const document = offline ? JSON.parse(readFileSync(documentPath, 'utf8')) : await fetchDocument()
const schemas = document.components.schemas
const CATALOG = JSON.parse(readFileSync(catalogPath, 'utf8'))
const wantedOperationIds = new Set(CATALOG.map((entry) => entry.operationId))

const METHODS = ['get', 'post', 'put', 'patch', 'delete']

/** Every operation in the document, keyed by its `operationId`. */
function collectOperations() {
  const byId = new Map()
  for (const [path, item] of Object.entries(document.paths)) {
    for (const method of METHODS) {
      const op = item[method]
      if (!op) continue
      if (!op.operationId) throw new Error(`${method.toUpperCase()} ${path} has no operationId`)
      byId.set(op.operationId, { ...op, method, path })
    }
  }
  return byId
}

const operations = collectOperations()

for (const id of wantedOperationIds) {
  if (!operations.has(id)) {
    throw new Error(`catalog.json names operationId '${id}', which is not in ${documentPath}`)
  }
}

/** Follow a `$ref` to the schema it names, one hop — callers resolve further. */
function derefOnce(node) {
  if (node && typeof node === 'object' && typeof node.$ref === 'string') {
    const name = refName(node.$ref)
    const target = schemas[name]
    if (!target) throw new Error(`unknown $ref ${node.$ref}`)
    return target
  }
  return node
}

function refName(ref) {
  const prefix = '#/components/schemas/'
  if (!ref.startsWith(prefix)) throw new Error(`unsupported $ref ${ref}`)
  return ref.slice(prefix.length)
}

/**
 * Deep-clone `node`, rewriting every `#/components/schemas/X` into
 * `#/$defs/X` and collecting `X`'s own (recursively rewritten) schema into
 * `defs`. `seen` breaks cycles: a schema that (transitively) refers to
 * itself still emits a valid `$ref` immediately, and `defs` fills in once
 * the recursive call returns.
 */
function localise(node, defs, seen) {
  if (Array.isArray(node)) return node.map((item) => localise(item, defs, seen))
  if (node === null || typeof node !== 'object') return node

  if (typeof node.$ref === 'string') {
    const name = refName(node.$ref)
    if (!seen.has(name)) {
      seen.add(name)
      defs[name] = localise(schemas[name], defs, seen)
    }
    return { $ref: `#/$defs/${name}` }
  }

  const out = {}
  for (const [key, value] of Object.entries(node)) {
    // The document's `pattern` keywords are Pydantic's, compiled against
    // Python's `re` — which accepts `\A`/`\z` (absolute start/end of
    // string) — and ajv compiles `pattern` with JavaScript's `RegExp`,
    // which does not know either escape and throws `SyntaxError` on them
    // rather than silently misreading them. `\A`/`\Z`/`\z` are translated to
    // their JS equivalents (`^`/`$`/`$`); every other pattern in this
    // document uses only syntax the two languages already agree on.
    out[key] = key === 'pattern' && typeof value === 'string' ? jsSafePattern(value) : localise(value, defs, seen)
  }
  return out
}

function jsSafePattern(pattern) {
  return pattern.replaceAll('\\A', '^').replaceAll('\\Z', '$').replaceAll('\\z', '$')
}

/** The schema a request body or a parameter actually describes, defs and all. */
function localSchema(schema) {
  const defs = {}
  const result = localise(schema, defs, new Set())
  return { result, defs }
}

/**
 * One operation's tool-facing shape: a flat argument object merging path
 * parameters, query parameters and (flattened) request-body fields, plus
 * which top-level names came from where — `src/tools/dispatch.ts` uses that
 * split to rebuild the `{ path, query, body }` call the client expects.
 */
function buildOperation(id) {
  const op = operations.get(id)
  const properties = {}
  const required = []
  const defs = {}
  const pathParams = []
  const queryParams = []

  for (const param of op.parameters ?? []) {
    const { result, defs: paramDefs } = localSchema(param.schema)
    Object.assign(defs, paramDefs)
    properties[param.name] = result
    if (param.in === 'path') {
      pathParams.push(param.name)
      required.push(param.name)
    } else if (param.in === 'query') {
      queryParams.push(param.name)
      if (param.required) required.push(param.name)
    } else {
      throw new Error(`${id}: unsupported parameter location '${param.in}'`)
    }
  }

  const hasBody = op.requestBody !== undefined
  if (hasBody) {
    const rawBodySchema = op.requestBody.content?.['application/json']?.schema
    if (!rawBodySchema) throw new Error(`${id}: request body is not application/json`)
    // The body's *own* schema (e.g. `UserIn`) is flattened into the tool's
    // top-level arguments rather than nested under a `body` property: a tool
    // call is one flat object, and there is no name collision in this API
    // between a body field and a path or query parameter.
    let bodyTop = rawBodySchema
    while (bodyTop.$ref) bodyTop = derefOnce(bodyTop)
    if (bodyTop.type !== undefined && bodyTop.type !== 'object') {
      throw new Error(`${id}: request body schema is not an object (${bodyTop.type})`)
    }
    for (const [name, propSchema] of Object.entries(bodyTop.properties ?? {})) {
      const { result, defs: propDefs } = localSchema(propSchema)
      Object.assign(defs, propDefs)
      if (name in properties) throw new Error(`${id}: '${name}' is both a parameter and a body field`)
      properties[name] = result
    }
    for (const name of bodyTop.required ?? []) required.push(name)
  }

  /** @type {Record<string, unknown>} */
  const inputSchema = {
    type: 'object',
    properties,
    // Nothing this API's own bodies accept as `extra=\"forbid\"` should be
    // silently swallowed by a permissive tool schema either.
    additionalProperties: false,
  }
  if (required.length > 0) inputSchema.required = [...new Set(required)]
  if (Object.keys(defs).length > 0) inputSchema.$defs = defs

  return {
    operationId: id,
    method: op.method,
    path: op.path,
    tag: op.tags?.[0] ?? '',
    summary: op.summary ?? '',
    description: typeof op.description === 'string' ? op.description : undefined,
    pathParams,
    queryParams,
    hasBody,
    inputSchema,
  }
}

const built = [...wantedOperationIds].sort().map(buildOperation)

const banner = `/**
 * GENERATED — do not edit.
 * \`pnpm generate:tools\`, from openapi/management-v1.json.
 *
 * One entry per operation named in \`src/tools/catalog.json\`: the HTTP method
 * and path template, which top-level argument names are path or query
 * parameters, and a self-contained JSON Schema for the rest.
 * \`src/tools/build.ts\` is what turns this into an MCP tool — naming it,
 * choosing its toolset, and annotating it destructive or secret-gated;
 * nothing here decides any of that.
 */

import type { JSONSchema } from '../types.js'

export interface GeneratedOperation {
  readonly operationId: string
  readonly method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  readonly path: string
  readonly tag: string
  readonly summary: string
  readonly description?: string
  readonly pathParams: readonly string[]
  readonly queryParams: readonly string[]
  readonly hasBody: boolean
  readonly inputSchema: JSONSchema
}

export const OPERATIONS: Readonly<Record<string, GeneratedOperation>> = {
${built.map((entry) => `  ${JSON.stringify(entry.operationId)}: ${indent(JSON.stringify(entry, null, 2), 2)},`).join('\n')}
}
`

function indent(text, spaces) {
  const pad = ' '.repeat(spaces)
  return text
    .split('\n')
    .map((line, index) => (index === 0 ? line : pad + line))
    .join('\n')
}

writeFileSync(outputPath, banner, 'utf8')
console.log(
  `wrote ${relative(repoRoot, outputPath)}: ${built.length} operations from ${relative(repoRoot, documentPath)}`,
)
