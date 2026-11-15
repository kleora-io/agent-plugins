import { describe, expect, it } from 'vitest'
import { CATALOG } from '../src/tools/catalog.js'
import { OPERATIONS } from '../src/generated/operations.js'
import { TOOLSETS } from '../src/types.js'

describe('CATALOG', () => {
  it('imports without throwing — its own validation already ran', () => {
    expect(CATALOG.length).toBeGreaterThan(0)
  })

  it('matches the generated operations one-to-one', () => {
    expect(new Set(CATALOG.map((entry) => entry.operationId))).toEqual(new Set(Object.keys(OPERATIONS)))
  })

  it('only ever assigns one of the six built toolsets', () => {
    for (const entry of CATALOG) {
      expect(TOOLSETS).toContain(entry.toolset)
    }
  })

  it('builds none of the off-by-default groups the ruling left unbuilt', () => {
    const unbuiltTags = ['branding', 'email-templates', 'settings', 'signing-keys', 'webhook-endpoints', 'webhook-events']
    for (const entry of CATALOG) {
      const operation = OPERATIONS[entry.operationId]
      expect(operation && unbuiltTags.includes(operation.tag)).toBe(false)
    }
  })

  it('excludes environment promotion, per the "promotion" toolset staying unbuilt', () => {
    expect(CATALOG.some((entry) => entry.operationId === 'promote_environment')).toBe(false)
  })

  it('excludes the caller-self MFA/passkey enrolment operations under the "me" tag', () => {
    const selfServiceIds = [
      'list_my_mfa_factors',
      'start_my_totp_enrollment',
      'confirm_my_totp_enrollment',
      'regenerate_my_recovery_codes',
      'start_my_passkey_registration',
      'finish_my_passkey_registration',
      'delete_my_mfa_factor',
    ]
    for (const id of selfServiceIds) {
      expect(CATALOG.some((entry) => entry.operationId === id)).toBe(false)
    }
  })
})
