/**
 * Wires an MCP `Server` to the tool catalog, the management client and the
 * session — the low-level `Server` rather than the `McpServer` convenience
 * wrapper, because a tool's `inputSchema` here is JSON Schema generated
 * straight from the management API's own OpenAPI document
 * (`scripts/generate-tools.mjs`), and the high-level API only accepts a Zod
 * shape. The MCP wire format for a tool is JSON Schema regardless of which
 * server-side API produces it (`Tool.inputSchema` in the SDK's own types),
 * so nothing here is off the beaten path.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import type { Config } from './config.js'
import {
  createCredentialStore,
  defaultConfigDir,
  issuerResolver,
  ManagementClient,
  Session,
  SessionNotReady,
} from '@kleora-io/core'

import { CONFIG_DIR_NAME, KEYCHAIN_SERVICE } from './credentials/where.js'
import { EnvironmentCache } from './environment-cache.js'
import { toolByName, toolsFor } from './tools/build.js'
import { dispatch, readMe } from './tools/dispatch.js'
import { USER_AGENT, VERSION } from './version.js'

const ME_RESOURCE_URI = 'kleora://me'

export interface BuildServerResult {
  server: Server
  connect: () => Promise<void>
}

export async function buildServer(config: Config): Promise<BuildServerResult> {
  const store = await createCredentialStore({
    service: KEYCHAIN_SERVICE,
    configDir: defaultConfigDir(CONFIG_DIR_NAME),
  })
  const session = new Session({
    // Asked of the API (`GET /api/v1/platform`) the first time the session
    // needs it, once per process; an explicit issuer asks nothing.
    issuer: issuerResolver(config.issuer, { baseUrl: config.baseUrl, userAgent: USER_AGENT }),
    clientId: config.clientId,
    profile: config.profile,
    store,
    userAgent: USER_AGENT,
  })

  const client = new ManagementClient({
    baseUrl: config.baseUrl,
    userAgent: USER_AGENT,
    getAccessToken: async () => {
      const state = await session.ensureAccessToken()
      if (state.status === 'ready') return state.accessToken
      throw new SessionNotReady(state)
    },
  })
  const environments = new EnvironmentCache()
  const reauthorize = (): void => session.invalidate()

  const server = new Server(
    { name: 'kleora-mcp', version: VERSION },
    { capabilities: { tools: {}, resources: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, () => {
    const tools = toolsFor({ toolsets: config.toolsets, readOnly: config.readOnly })
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      })),
    }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = toolByName(request.params.name)
    if (!tool) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              type: 'about:blank',
              title: 'unknown-tool',
              detail: `No tool named '${request.params.name}'.`,
            }),
          },
        ],
        isError: true,
      }
    }
    return dispatch(tool, request.params.arguments, { client, environments, reauthorize })
  })

  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: [
      {
        uri: ME_RESOURCE_URI,
        name: 'The calling principal',
        description:
          'GET /me: principal, account, memberships and permissions. ' +
          'Read this once rather than calling kleora_whoami on every turn.',
        mimeType: 'application/json',
      },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== ME_RESOURCE_URI) {
      throw new Error(`unknown resource '${request.params.uri}'`)
    }
    const me = await readMe({ client, reauthorize })
    return {
      contents: [{ uri: ME_RESOURCE_URI, mimeType: 'application/json', text: JSON.stringify(me, null, 2) }],
    }
  })

  return {
    server,
    connect: async () => {
      const transport = new StdioServerTransport()
      await server.connect(transport)
    },
  }
}
