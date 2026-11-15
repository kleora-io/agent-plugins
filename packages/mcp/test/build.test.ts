/**
 * The properties of the tool list that are true by construction of
 * `ALL_TOOLS`, checked here so a future catalog edit that breaks one of them
 * fails a test rather than shipping quietly.
 */
import Ajv from 'ajv'
import { describe, expect, it } from 'vitest'
import { ALL_TOOLS, toolsFor } from '../src/tools/build.js'
import { CATALOG } from '../src/tools/catalog.js'
import { TOOLSETS } from '../src/types.js'

describe('the tool list', () => {
  it('has one tool per catalog entry, all named kleora_*, all unique', () => {
    expect(ALL_TOOLS).toHaveLength(CATALOG.length)
    const names = new Set(ALL_TOOLS.map((tool) => tool.name))
    expect(names.size).toBe(ALL_TOOLS.length)
    for (const tool of ALL_TOOLS) expect(tool.name.startsWith('kleora_')).toBe(true)
  })

  it('does not vary by permission — the same configuration always lists the same tools', () => {
    // `toolsFor`'s only parameters are toolset selection and `--read-only`,
    // both static configuration — there is no caller or permission input
    // anywhere in this module.
    const first = toolsFor({ toolsets: TOOLSETS, readOnly: false })
    const second = toolsFor({ toolsets: TOOLSETS, readOnly: false })
    expect(first).toEqual(second)
  })

  it('carries destructiveHint on exactly the destructive catalog entries, and never on a read', () => {
    for (const tool of ALL_TOOLS) {
      const entry = CATALOG.find((row) => row.name === tool.name)
      expect(entry).toBeDefined()
      if (entry?.destructive) {
        expect(tool.annotations.destructiveHint).toBe(true)
      } else {
        expect(tool.annotations.destructiveHint).toBeUndefined()
      }
      if (tool.annotations.readOnlyHint) {
        expect(tool.annotations.destructiveHint).toBeUndefined()
        expect(tool.operation.method).toBe('get')
      }
    }
  })

  it('marks the headline destructive tools destructive', () => {
    const named = [
      'kleora_app_delete',
      'kleora_user_erase',
      'kleora_environment_sessions_revoke_all',
      'kleora_user_sessions_revoke_all',
      'kleora_user_session_revoke',
      'kleora_tenant_delete',
      'kleora_tenant_suspend',
      'kleora_member_remove',
      'kleora_user_mfa_remove',
      'kleora_client_rotate_secret',
      'kleora_role_permissions_set',
      'kleora_user_send_password_reset',
      'kleora_user_send_verification',
      'kleora_invitation_create',
      'kleora_invitation_resend',
    ]
    for (const name of named) {
      const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
      expect(tool, `expected a tool named ${name}`).toBeDefined()
      expect(tool?.annotations.destructiveHint).toBe(true)
    }
  })

  it('gates the secret opt-in on exactly the secret-minting tools, with a redaction note built in', () => {
    const secretGated = [
      'kleora_api_key_create',
      'kleora_api_key_rotate',
      'kleora_client_rotate_secret',
      // A web client's create response carries its secret once too; see
      // catalog.ts's own docstring.
      'kleora_client_create',
    ]
    for (const name of secretGated) {
      const tool = ALL_TOOLS.find((candidate) => candidate.name === name)
      expect(tool?.secretField).not.toBeNull()
      const properties = tool?.inputSchema['properties'] as Record<string, unknown>
      expect(properties['return_secret']).toBeDefined()
    }
    for (const tool of ALL_TOOLS) {
      if (secretGated.includes(tool.name)) continue
      expect(tool.secretField).toBeNull()
      const properties = tool.inputSchema['properties'] as Record<string, unknown>
      expect(properties['return_secret']).toBeUndefined()
    }
  })

  it('requires environment_id (or a deeper resource id) on every path parameter, with no default anywhere', () => {
    for (const tool of ALL_TOOLS) {
      const required = (tool.inputSchema['required'] as string[] | undefined) ?? []
      for (const param of tool.operation.pathParams) {
        expect(required, `${tool.name} must require its own path parameter '${param}'`).toContain(param)
        const schema = (tool.inputSchema['properties'] as Record<string, unknown>)[param]
        expect(schema, `${tool.name} must declare a schema for '${param}'`).toBeDefined()
        // No default value anywhere on a path parameter: environments are
        // never implicit, so there is no default and no remembered value.
        expect((schema as Record<string, unknown>)['default']).toBeUndefined()
      }
    }
  })

  it('compiles as valid JSON Schema for every tool (ajv, no unresolved $ref)', () => {
    const ajv = new Ajv({ strict: false, logger: false })
    for (const tool of ALL_TOOLS) {
      expect(() => ajv.compile(tool.inputSchema), tool.name).not.toThrow()
    }
  })
})

describe('toolsFor', () => {
  it('defaults to all six on-by-default toolsets', () => {
    expect(TOOLSETS).toHaveLength(6)
    const tools = toolsFor({ toolsets: TOOLSETS, readOnly: false })
    expect(tools).toHaveLength(ALL_TOOLS.length)
  })

  it('a single toolset lists only that toolset', () => {
    const tools = toolsFor({ toolsets: ['audit'], readOnly: false })
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((tool) => tool.toolset === 'audit')).toBe(true)
  })

  it('--read-only drops every non-read tool, and every destructive tool along with it', () => {
    const tools = toolsFor({ toolsets: TOOLSETS, readOnly: true })
    expect(tools.length).toBeGreaterThan(0)
    expect(tools.every((tool) => tool.annotations.readOnlyHint === true)).toBe(true)
    expect(tools.some((tool) => tool.annotations.destructiveHint)).toBe(false)
    // Every destructive tool from the full list is entirely absent, not just
    // unusable: a host cannot approve a mutation that was never offered.
    const destructiveNames = new Set(
      ALL_TOOLS.filter((tool) => tool.annotations.destructiveHint).map((tool) => tool.name),
    )
    expect(tools.some((tool) => destructiveNames.has(tool.name))).toBe(false)
  })
})
