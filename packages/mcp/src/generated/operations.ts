/**
 * GENERATED — do not edit.
 * `pnpm generate:tools`, from openapi/management-v1.json.
 *
 * One entry per operation named in `src/tools/catalog.json`: the HTTP method
 * and path template, which top-level argument names are path or query
 * parameters, and a self-contained JSON Schema for the rest.
 * `src/tools/build.ts` is what turns this into an MCP tool — naming it,
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
  "add_member_operation": {
    "operationId": "add_member_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/members",
    "tag": "members",
    "summary": "Add a member",
    "description": "Add an existing user to the tenant, with the roles the body names.\n\nGive exactly one of `user_id` and `email`; both or neither is `422`. The email is normalised\nbefore lookup, so its case does not matter. A user who is not in this environment, or has been\nerased, is `404 user-not-found`; this operation sends no invitation.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "email": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Email"
        },
        "roles": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Roles",
          "type": "array"
        },
        "user_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "User Id"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "block_user_operation": {
    "operationId": "block_user_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/block",
    "tag": "users",
    "summary": "Block a user",
    "description": "Block the user from signing in, and end everything already signed in.\n\nIn one transaction: the status changes, and every live session and its refresh tokens are\nrevoked. A blocked user's next sign-in is refused exactly as a wrong password is, and a refresh\nanswers `invalid_grant`.\n\nThe body is optional and carries one field, `reason`: a note of up to 200 characters, stored\nwith the block and included in the `user.blocked` event's `data.reason`.\n\nIdempotent: blocking a blocked user answers `200` with no second event, and does not overwrite\nthe reason first recorded. To change it, unblock and block again.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "create_account_operation": {
    "operationId": "create_account_operation",
    "method": "post",
    "path": "/api/v1/accounts",
    "tag": "accounts",
    "summary": "Create an account",
    "description": "Create an additional Account for the person holding a console token.\n\nOnly a console user's token may call this; an API key or a tenant member's token is refused. The\nperson's email address must be verified, and the number of Accounts a person may hold is\nlimited.\n\nNo `Location` header: `/account` always means the Account the token was issued for, and the new\nAccount becomes reachable once the console signs in again for it.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "maxLength": 100,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "slug": {
          "anyOf": [
            {
              "pattern": "^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Slug"
        }
      },
      "additionalProperties": false,
      "required": [
        "name"
      ]
    }
  },
  "create_api_key_operation": {
    "operationId": "create_api_key_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/api-keys",
    "tag": "api-keys",
    "summary": "Create an API key",
    "description": "Create an API key. Its prefix follows the environment's kind.\n\nThe `201` carries the full key, once, and is never cached. Repeating the request with the same\n`Idempotency-Key` returns the same response, key included; without one, a second request creates\na second key.\n\n- A scope that is not allowed: `422 invalid-scope`, naming each.\n- An environment that already has 100 keys that are not revoked: `422 limit-exceeded`.\n- An `expires_at` less than 60 seconds ahead: `422 validation-error` on that field.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "expires_at": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Expires At"
        },
        "name": {
          "maxLength": 100,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "scopes": {
          "items": {
            "maxLength": 100,
            "type": "string"
          },
          "maxItems": 28,
          "title": "Scopes",
          "type": "array"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "name",
        "scopes"
      ]
    }
  },
  "create_app_operation": {
    "operationId": "create_app_operation",
    "method": "post",
    "path": "/api/v1/apps",
    "tag": "apps",
    "summary": "Create an app",
    "description": "Create an App with its production and sandbox environments and their default contents.\n\nEither everything is created or nothing is. Accepts an `Idempotency-Key` header, which is\nrecommended given how much one call provisions.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "maxLength": 100,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "slug": {
          "anyOf": [
            {
              "pattern": "^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Slug"
        }
      },
      "additionalProperties": false,
      "required": [
        "name"
      ]
    }
  },
  "create_client_operation": {
    "operationId": "create_client_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/clients",
    "tag": "clients",
    "summary": "Create a client",
    "description": "Create a `spa`, `web` or `native` OAuth client. The `client_id` is generated.\n\nFor `kind: \"web\"`, the `201` carries the client secret, once, and is never cached. Repeating the\nrequest with the same `Idempotency-Key` returns the same response, secret included.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "allowed_scopes": {
          "items": {
            "type": "string"
          },
          "title": "Allowed Scopes",
          "type": "array"
        },
        "device_grant_enabled": {
          "default": false,
          "title": "Device Grant Enabled",
          "type": "boolean"
        },
        "initiate_login_uri": {
          "anyOf": [
            {
              "maxLength": 2000,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Initiate Login Uri"
        },
        "kind": {
          "enum": [
            "spa",
            "web",
            "native"
          ],
          "title": "Kind",
          "type": "string"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "post_logout_redirect_uris": {
          "items": {
            "maxLength": 2000,
            "type": "string"
          },
          "maxItems": 32,
          "title": "Post Logout Redirect Uris",
          "type": "array"
        },
        "redirect_uris": {
          "items": {
            "maxLength": 2000,
            "type": "string"
          },
          "maxItems": 32,
          "title": "Redirect Uris",
          "type": "array"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "name",
        "kind"
      ]
    }
  },
  "create_invitation_operation": {
    "operationId": "create_invitation_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/invitations",
    "tag": "invitations",
    "summary": "Invite an address",
    "description": "Create an invitation and email the link. The token is not returned.\n\nThe roles are validated as `POST /tenants/{tenant_id}/members` validates them: a tenant member\nmay only offer roles within its own permissions, and `owner` in an Account's tenant may only be\noffered by a member who holds it.\n\nWith an `Idempotency-Key`, a repeated request returns the stored `201` and sends no second\nemail.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "email": {
          "title": "Email",
          "type": "string"
        },
        "roles": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Roles",
          "type": "array"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "email"
      ]
    }
  },
  "create_permission_operation": {
    "operationId": "create_permission_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/permissions",
    "tag": "permissions",
    "summary": "Create a permission",
    "description": "Create a permission.\n\nA name whose resource part is one of the reserved resources (for example `users:export`) is `422\nreserved-permission`.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "description": {
          "default": "",
          "maxLength": 500,
          "title": "Description",
          "type": "string"
        },
        "name": {
          "maxLength": 128,
          "pattern": "^[a-z0-9_-]+:[a-z0-9_-]+$",
          "title": "Name",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "name"
      ]
    }
  },
  "create_role_operation": {
    "operationId": "create_role_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/roles",
    "tag": "roles",
    "summary": "Create an app-scoped role",
    "description": "Create an app-scoped role, assignable in every tenant of the environment.\n\nRole slugs are unique across the environment, including tenants' own roles: a slug a tenant\nalready uses is `409 role-slug-conflict`.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "description": {
          "default": "",
          "maxLength": 500,
          "title": "Description",
          "type": "string"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "permissions": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Permissions",
          "type": "array"
        },
        "slug": {
          "maxLength": 64,
          "pattern": "^[a-z0-9_-]{1,64}$",
          "title": "Slug",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "name",
        "slug"
      ]
    }
  },
  "create_tenant_operation": {
    "operationId": "create_tenant_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/tenants",
    "tag": "tenants",
    "summary": "Create a tenant",
    "description": "Create a tenant with no members.\n\n- In `single` tenant mode: `409 tenant-mode-single`.\n- The slugs `default` and `kleora` are reserved: `409 slug-reserved`.\n- A slug another tenant holds: `409 slug-taken`.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "metadata": {
          "additionalProperties": true,
          "title": "Metadata",
          "type": "object"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "slug": {
          "maxLength": 64,
          "pattern": "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
          "title": "Slug",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "name",
        "slug"
      ]
    }
  },
  "create_tenant_role_operation": {
    "operationId": "create_tenant_role_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/roles",
    "tag": "roles",
    "summary": "Create a tenant-scoped role",
    "description": "Create a role that this tenant defines for itself, assignable only to its own members.\n\nThe role is deleted with the tenant, and cannot be assigned in another tenant (`422\nrole-not-assignable` there). A tenant member may create one, but only with permissions it holds\nitself: `403 privilege-escalation` otherwise.\n\nA slug used by an app-scoped role of the environment is `409 role-slug-conflict`. Another tenant\nof the same environment may use the same slug for its own role.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "description": {
          "default": "",
          "maxLength": 500,
          "title": "Description",
          "type": "string"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "permissions": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Permissions",
          "type": "array"
        },
        "slug": {
          "maxLength": 64,
          "pattern": "^[a-z0-9_-]{1,64}$",
          "title": "Slug",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "name",
        "slug"
      ]
    }
  },
  "create_user_operation": {
    "operationId": "create_user_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users",
    "tag": "users",
    "summary": "Create a user",
    "description": "Create a user as an administrator.\n\nAn address already registered in the environment is `409 email-taken`. `password` is optional:\nwithout one the user has no password until a reset sets one, and `has_password` says so. The\npassword is never returned.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "email": {
          "maxLength": 254,
          "minLength": 1,
          "title": "Email",
          "type": "string"
        },
        "email_verified": {
          "default": false,
          "title": "Email Verified",
          "type": "boolean"
        },
        "locale": {
          "anyOf": [
            {
              "enum": [
                "en",
                "pl"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Locale"
        },
        "metadata": {
          "additionalProperties": true,
          "title": "Metadata",
          "type": "object"
        },
        "name": {
          "default": "",
          "maxLength": 200,
          "title": "Name",
          "type": "string"
        },
        "password": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Password"
        },
        "send_verification": {
          "default": false,
          "title": "Send Verification",
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "email"
      ]
    }
  },
  "delete_api_key_operation": {
    "operationId": "delete_api_key_operation",
    "method": "delete",
    "path": "/api/v1/environments/{environment_id}/api-keys/{api_key_id}",
    "tag": "api-keys",
    "summary": "Delete an API key",
    "description": "Delete an API key, whether or not it was revoked first.\n\nThe key stops working immediately. The `api_key.deleted` audit event keeps the key's `name` and\n`prefix`.",
    "pathParams": [
      "environment_id",
      "api_key_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "api_key_id": {
          "title": "Api Key Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "api_key_id"
      ]
    }
  },
  "delete_app_operation": {
    "operationId": "delete_app_operation",
    "method": "delete",
    "path": "/api/v1/apps/{app_id}",
    "tag": "apps",
    "summary": "Delete an app",
    "description": "Delete the App, both its environments and everything in them, in one transaction.\n\nRefused for the platform's own `id` App. Repeating the `DELETE` answers `404`.",
    "pathParams": [
      "app_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "app_id": {
          "title": "App Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "app_id"
      ]
    }
  },
  "delete_client_operation": {
    "operationId": "delete_client_operation",
    "method": "delete",
    "path": "/api/v1/environments/{environment_id}/clients/{client_id}",
    "tag": "clients",
    "summary": "Delete a client",
    "description": "Delete an OAuth client, with its authorization codes, pending authorization requests and\nrefresh tokens.\n\nBrowser sessions are not affected, since they are shared by the environment's clients; tokens\nissued through this client can no longer be refreshed. `409 client-default` for the\nenvironment's default client.",
    "pathParams": [
      "environment_id",
      "client_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "client_id": {
          "title": "Client Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "client_id"
      ]
    }
  },
  "delete_permission_operation": {
    "operationId": "delete_permission_operation",
    "method": "delete",
    "path": "/api/v1/permissions/{permission_id}",
    "tag": "permissions",
    "summary": "Delete a permission",
    "description": "Remove it from every Role that carried it. Reserved ones are 409 `system-permission`.",
    "pathParams": [
      "permission_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "permission_id": {
          "title": "Permission Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "permission_id"
      ]
    }
  },
  "delete_role_operation": {
    "operationId": "delete_role_operation",
    "method": "delete",
    "path": "/api/v1/roles/{role_id}",
    "tag": "roles",
    "summary": "Delete a role",
    "description": "Delete a role, removing it from every member and open invitation that carries it.\n\nThe system roles `owner`, `admin`, `developer`, `billing` and `viewer` cannot be deleted: `409\nsystem-role`.",
    "pathParams": [
      "role_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "role_id": {
          "title": "Role Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "role_id"
      ]
    }
  },
  "delete_tenant_operation": {
    "operationId": "delete_tenant_operation",
    "method": "delete",
    "path": "/api/v1/tenants/{tenant_id}",
    "tag": "tenants",
    "summary": "Delete a tenant",
    "description": "Delete a tenant, its members, its own roles and its invitations, in one transaction.\n\nSessions bound to the tenant are revoked. The environment's default tenant cannot be deleted\n(`409 default-tenant`), nor can a tenant linked to an Account (`409 account-tenant`).",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "delete_user_mfa_factor": {
    "operationId": "delete_user_mfa_factor",
    "method": "delete",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/mfa/{factor_id}",
    "tag": "users",
    "summary": "Administrative MFA reset",
    "description": "Reset the user's MFA: remove their factors, and email them a notice.\n\nRemoving a TOTP factor or the recovery codes removes both, so the id only has to name one factor\nof this user. An id of another user's factor is `404`. Sessions are not revoked; if the\nenvironment requires MFA, the user enrols again at the next sign-in.\n\nAvailable on every plan: this is how a user who has lost their device and their recovery codes\ngets back in.",
    "pathParams": [
      "environment_id",
      "user_id",
      "factor_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "factor_id": {
          "title": "Factor Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id",
        "factor_id"
      ]
    }
  },
  "delete_user_operation": {
    "operationId": "delete_user_operation",
    "method": "delete",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}",
    "tag": "users",
    "summary": "Erase a user",
    "description": "Erase a user. The user's record is kept, with its identifying data overwritten.\n\n`?erase=true` is accepted and changes nothing: every deletion is an erasure.\n\nIrreversible. Credentials and memberships are deleted, and the audit trail keeps only the user's\nid. `409 last-owner` while the user is the last active owner of an Account's tenant.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [
      "erase"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "erase": {
          "default": true,
          "title": "Erase",
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "delete_user_session": {
    "operationId": "delete_user_session",
    "method": "delete",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/sessions/{session_id}",
    "tag": "users",
    "summary": "Revoke a session",
    "description": "Revoke the session and its refresh tokens. Idempotent.\n\nA session id that is not this user's, or not a UUID, is `404`. Revoking a session that is\nalready revoked is also `204`, with no second event. `409 conflict` when the session is deleted\nwhile the request is being processed.",
    "pathParams": [
      "environment_id",
      "user_id",
      "session_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "session_id": {
          "title": "Session Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id",
        "session_id"
      ]
    }
  },
  "export_user": {
    "operationId": "export_user",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/export",
    "tag": "users",
    "summary": "Export a user",
    "description": "Everything Kleora holds about one user, as one document.\n\nThe user record, identities without their secrets, MFA factors without their seeds, memberships,\nsessions, and the audit events where the user is actor or target, newest first. The audit events\nare capped, and `audit_events_truncated` says when the cap applied. The response is never\ncached.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "list_account_audit_events": {
    "operationId": "list_account_audit_events",
    "method": "get",
    "path": "/api/v1/account/audit-events",
    "tag": "audit",
    "summary": "The account's audit events",
    "description": "Every audit event of the Account, including account-level events, newest first.\n\n`environment_id` and `tenant_id` narrow the list; an id from another Account matches nothing.\nOnly available to console users: an API key or a tenant member's token is `403\ninsufficient-scope`.",
    "pathParams": [],
    "queryParams": [
      "limit",
      "cursor",
      "action",
      "actor_id",
      "target_id",
      "from",
      "to",
      "format",
      "tenant_id",
      "environment_id"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "action": {
          "anyOf": [
            {
              "items": {
                "maxLength": 64,
                "pattern": "^[a-z_]+(\\.[a-z_]+)*(\\.\\*)?$",
                "type": "string"
              },
              "maxItems": 20,
              "type": "array"
            },
            {
              "type": "null"
            }
          ],
          "title": "Action"
        },
        "actor_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Actor Id"
        },
        "target_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Target Id"
        },
        "from": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "From"
        },
        "to": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "To"
        },
        "format": {
          "default": "json",
          "enum": [
            "json",
            "ndjson"
          ],
          "title": "Format",
          "type": "string"
        },
        "tenant_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Tenant Id"
        },
        "environment_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Environment Id"
        }
      },
      "additionalProperties": false
    }
  },
  "list_api_keys": {
    "operationId": "list_api_keys",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/api-keys",
    "tag": "api-keys",
    "summary": "List API keys",
    "description": "The environment's API keys, newest first, optionally filtered by `status` or searched.\n\n`status` is computed from the revocation and expiry times, evaluated once for the whole page.\n`q` is a case-insensitive substring of `name`. A cursor is only valid with the filters it was\nissued for.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "status",
      "q"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "status": {
          "anyOf": [
            {
              "enum": [
                "active",
                "expired",
                "revoked"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Status"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_app_environments": {
    "operationId": "list_app_environments",
    "method": "get",
    "path": "/api/v1/apps/{app_id}/environments",
    "tag": "apps",
    "summary": "An app's environments",
    "description": "The App's two environments, in the standard list envelope.\n\nNot paginated: an App always has exactly two environments, so `next_cursor` is always `null`.",
    "pathParams": [
      "app_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "app_id": {
          "title": "App Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "app_id"
      ]
    }
  },
  "list_apps": {
    "operationId": "list_apps",
    "method": "get",
    "path": "/api/v1/apps",
    "tag": "apps",
    "summary": "List apps",
    "description": "The Account's Apps, oldest first, optionally filtered to one slug or searched.\n\n`slug` is an exact, case-sensitive match. A slug that belongs to another Account returns an\nempty page rather than `404`. `q` is a case-insensitive substring of `name` or `slug`. A cursor\nis only valid with the filters it was issued for.",
    "pathParams": [],
    "queryParams": [
      "limit",
      "cursor",
      "slug",
      "q"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "slug": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Slug"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        }
      },
      "additionalProperties": false
    }
  },
  "list_clients": {
    "operationId": "list_clients",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/clients",
    "tag": "clients",
    "summary": "List clients",
    "description": "The environment's OAuth clients, oldest first, optionally filtered or searched.\n\n`?is_default=true` returns the environment's default client, and `?is_default=false` the rest.\n`q` is a case-insensitive substring of `name` or `client_id`. A cursor is only valid with the\nfilters it was issued for.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "is_default",
      "q"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "is_default": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ],
          "title": "Is Default"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_environment_audit_events": {
    "operationId": "list_environment_audit_events",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/audit-events",
    "tag": "audit",
    "summary": "An environment's audit events",
    "description": "Every audit event recorded against this environment, newest first.\n\nAccount-level events, and events of Apps that have since been deleted, are not included; read\nthem with `GET /account/audit-events`. `?tenant_id=` narrows the list further.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "action",
      "actor_id",
      "target_id",
      "from",
      "to",
      "format",
      "tenant_id"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "action": {
          "anyOf": [
            {
              "items": {
                "maxLength": 64,
                "pattern": "^[a-z_]+(\\.[a-z_]+)*(\\.\\*)?$",
                "type": "string"
              },
              "maxItems": 20,
              "type": "array"
            },
            {
              "type": "null"
            }
          ],
          "title": "Action"
        },
        "actor_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Actor Id"
        },
        "target_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Target Id"
        },
        "from": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "From"
        },
        "to": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "To"
        },
        "format": {
          "default": "json",
          "enum": [
            "json",
            "ndjson"
          ],
          "title": "Format",
          "type": "string"
        },
        "tenant_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Tenant Id"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_invitations": {
    "operationId": "list_invitations",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}/invitations",
    "tag": "invitations",
    "summary": "List invitations",
    "description": "The tenant's invitations in one state, newest first.\n\n`status` defaults to `open`: the invitations still waiting for an answer. `q` is a\ncase-insensitive substring of the invited email. A cursor is only valid with the filters it was\nissued for.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "status",
      "q"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "status": {
          "default": "open",
          "enum": [
            "open",
            "accepted",
            "revoked",
            "expired"
          ],
          "title": "Status",
          "type": "string"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "list_members": {
    "operationId": "list_members",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}/members",
    "tag": "members",
    "summary": "List members",
    "description": "The tenant's members, newest first, with the user and the roles included.\n\n`q` is a case-insensitive substring of the user's email or name, and `role` is a role slug. A\ncursor is only valid with the filters it was issued for.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "q",
      "role",
      "status"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        },
        "role": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Role"
        },
        "status": {
          "anyOf": [
            {
              "enum": [
                "active",
                "suspended"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Status"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "list_permissions": {
    "operationId": "list_permissions",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/permissions",
    "tag": "permissions",
    "summary": "List permissions",
    "description": "The environment's permissions by name: the platform's reserved permissions and your own.\n\n`?system=true` lists the reserved permissions and `?system=false` your own. `q` is a\ncase-insensitive substring of `name`. A cursor is only valid with the filters it was issued for.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "q",
      "system"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        },
        "system": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ],
          "title": "System"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_roles": {
    "operationId": "list_roles",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/roles",
    "tag": "roles",
    "summary": "List app-scoped roles",
    "description": "The environment's app-scoped roles by slug.\n\nTenant-scoped roles are listed under the tenant that defines them, at `GET\n/tenants/{tenant_id}/roles`. `q` is a case-insensitive substring of the slug or the name.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "q"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_tenant_audit_events": {
    "operationId": "list_tenant_audit_events",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}/audit-events",
    "tag": "audit",
    "summary": "A tenant's audit events",
    "description": "Every audit event recorded against this tenant, newest first.\n\nAvailable to the tenant's own members. Another tenant's id is `404`.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "action",
      "actor_id",
      "target_id",
      "from",
      "to",
      "format"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "action": {
          "anyOf": [
            {
              "items": {
                "maxLength": 64,
                "pattern": "^[a-z_]+(\\.[a-z_]+)*(\\.\\*)?$",
                "type": "string"
              },
              "maxItems": 20,
              "type": "array"
            },
            {
              "type": "null"
            }
          ],
          "title": "Action"
        },
        "actor_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Actor Id"
        },
        "target_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Target Id"
        },
        "from": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "From"
        },
        "to": {
          "anyOf": [
            {
              "format": "date-time",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "To"
        },
        "format": {
          "default": "json",
          "enum": [
            "json",
            "ndjson"
          ],
          "title": "Format",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "list_tenant_roles": {
    "operationId": "list_tenant_roles",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}/roles",
    "tag": "roles",
    "summary": "Roles assignable in a tenant",
    "description": "Every role assignable in this tenant: the environment's app-scoped roles and the tenant's\nown.\n\nThis is how a tenant member sees app-scoped roles. `q` is a case-insensitive substring of the\nslug or the name.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "q",
      "scope"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        },
        "scope": {
          "anyOf": [
            {
              "enum": [
                "app",
                "tenant"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Scope"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "list_tenants": {
    "operationId": "list_tenants",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/tenants",
    "tag": "tenants",
    "summary": "List tenants",
    "description": "The environment's tenants, newest first, filtered by `q` and `status`.\n\nIn `single` tenant mode, the default tenant is not listed. `q` is a case-insensitive substring\nof the name or the slug. A cursor is only valid with the filters it was issued for.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "q",
      "status"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        },
        "status": {
          "anyOf": [
            {
              "enum": [
                "active",
                "suspended"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Status"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "list_user_memberships": {
    "operationId": "list_user_memberships",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/memberships",
    "tag": "users",
    "summary": "A user's memberships",
    "description": "Which tenants this user belongs to, and what it holds in each.\n\nOldest first, the surface's default: a membership list is a history of how\nsomebody came to have the access they have, and it reads forwards.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [
      "limit",
      "cursor"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "list_user_mfa_factors": {
    "operationId": "list_user_mfa_factors",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/mfa",
    "tag": "users",
    "summary": "A user's MFA factors",
    "description": "Every MFA factor of the user, confirmed or not.\n\nAvailable on every plan, since resetting a user's MFA needs a factor id from this list. Not\npaginated: a user holds at most a few factors. Secrets and recovery code hashes are never\nreturned.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "list_user_sessions": {
    "operationId": "list_user_sessions",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/sessions",
    "tag": "users",
    "summary": "A user's sessions",
    "description": "The user's browser sessions, newest first; only live ones unless `include_expired` is set.\n\nA live session is not revoked, has not expired, and has been used within the environment's\n`session_idle_ttl`. A cursor is only valid with the `include_expired` value it was issued for.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "include_expired"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "include_expired": {
          "default": false,
          "title": "Include Expired",
          "type": "boolean"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "list_users": {
    "operationId": "list_users",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users",
    "tag": "users",
    "summary": "List users",
    "description": "The environment's users, newest first, narrowed by up to six filters.\n\nErased users are excluded unless `status=erased` asks for them.\n\n`session=active` selects users holding at least one live session. It counts users, not sessions,\nso it can differ from the overview's count of active sessions.\n\nA cursor is only valid with the filters it was issued for, and a tenant member's cursor only\nwithin its own tenant.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [
      "limit",
      "cursor",
      "email",
      "q",
      "status",
      "tenant_id",
      "mfa",
      "session"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "limit": {
          "default": 50,
          "maximum": 200,
          "minimum": 1,
          "title": "Limit",
          "type": "integer"
        },
        "cursor": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Cursor"
        },
        "email": {
          "anyOf": [
            {
              "maxLength": 254,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Email"
        },
        "q": {
          "anyOf": [
            {
              "maxLength": 100,
              "minLength": 1,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Q"
        },
        "status": {
          "anyOf": [
            {
              "enum": [
                "active",
                "blocked",
                "erased"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Status"
        },
        "tenant_id": {
          "anyOf": [
            {
              "format": "uuid",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Tenant Id"
        },
        "mfa": {
          "anyOf": [
            {
              "enum": [
                "enrolled",
                "none"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Mfa"
        },
        "session": {
          "anyOf": [
            {
              "const": "active",
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Session"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "me": {
    "operationId": "me",
    "method": "get",
    "path": "/api/v1/me",
    "tag": "me",
    "summary": "The calling principal",
    "description": "Who the credential belongs to, what it may do, and where it may do it.\n\nAvailable to every kind of credential, and one of the two operations (with `GET /account`) still\navailable while the Account is suspended.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "patch_account": {
    "operationId": "patch_account",
    "method": "patch",
    "path": "/api/v1/account",
    "tag": "accounts",
    "summary": "Rename the account",
    "description": "Rename the Account. `slug`, `plan`, `status` and `tenant_id` cannot be changed.\n\nNot available while the Account is suspended.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "name": {
          "maxLength": 100,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        }
      },
      "additionalProperties": false
    }
  },
  "patch_app": {
    "operationId": "patch_app",
    "method": "patch",
    "path": "/api/v1/apps/{app_id}",
    "tag": "apps",
    "summary": "Rename an app",
    "description": "Rename it. The slug is not a property that can move; the schema says so.",
    "pathParams": [
      "app_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "app_id": {
          "title": "App Id",
          "type": "string"
        },
        "name": {
          "maxLength": 100,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "app_id"
      ]
    }
  },
  "patch_client": {
    "operationId": "patch_client",
    "method": "patch",
    "path": "/api/v1/environments/{environment_id}/clients/{client_id}",
    "tag": "clients",
    "summary": "Change a client",
    "description": "Update an OAuth client (merge patch). The secret cannot be changed here.\n\n- `{\"is_default\": false}` is `409 client-default`: an environment always has a default client;\n  make another client the default instead.\n- `409 conflict` when a concurrent change prevents the update.\n- Changing `kind` away from `web` removes the secret, and the response has `has_secret: false`.",
    "pathParams": [
      "environment_id",
      "client_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "client_id": {
          "title": "Client Id",
          "type": "string"
        },
        "allowed_scopes": {
          "items": {
            "type": "string"
          },
          "title": "Allowed Scopes",
          "type": "array"
        },
        "device_grant_enabled": {
          "title": "Device Grant Enabled",
          "type": "boolean"
        },
        "initiate_login_uri": {
          "anyOf": [
            {
              "maxLength": 2000,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Initiate Login Uri"
        },
        "is_default": {
          "title": "Is Default",
          "type": "boolean"
        },
        "kind": {
          "enum": [
            "spa",
            "web",
            "native"
          ],
          "title": "Kind",
          "type": "string"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "post_logout_redirect_uris": {
          "items": {
            "maxLength": 2000,
            "type": "string"
          },
          "maxItems": 32,
          "title": "Post Logout Redirect Uris",
          "type": "array"
        },
        "redirect_uris": {
          "items": {
            "maxLength": 2000,
            "type": "string"
          },
          "maxItems": 32,
          "title": "Redirect Uris",
          "type": "array"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "client_id"
      ]
    }
  },
  "patch_environment": {
    "operationId": "patch_environment",
    "method": "patch",
    "path": "/api/v1/environments/{environment_id}",
    "tag": "environments",
    "summary": "Change an environment's settings",
    "description": "Update any subset of the environment's settings.\n\n- `tenant_mode` and `no_tenant_behaviour` cannot be changed on the platform's own `id` App: `409\n  platform-protected`.\n- `no_tenant_behaviour=create` needs a `tenant_creator_role`, which must name an app-scoped role\n  of this environment; otherwise `422` naming the field.\n- Switching `tenant_mode` from `multi` to `single` is refused while another tenant exists (`409\n  tenant-mode-switch-blocked`) or while an earlier switch is still being applied (`409\n  tenant-mode-backfill-pending`).\n\nThe `PATCH` that switches to `single` answers `202`: the settings are saved, but the memberships\nthe new mode needs are written in the background, and `backfill_status` reads `pending` until\nthat is done.\n\n`mfa_policy: required` is `402 payment-required` on a plan without MFA enforcement; `off` and\n`optional` are available on every plan.\n\n`mfa_policy`, `password_min_length` and `password_breach_check` can only be changed by a console\nuser. Any other credential sending one of them, whatever the value, gets `403\ninsufficient-scope` naming the fields, and nothing in the request is applied.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "access_token_ttl": {
          "maximum": 3600,
          "minimum": 60,
          "title": "Access Token Ttl",
          "type": "integer"
        },
        "allow_browser_locale": {
          "title": "Allow Browser Locale",
          "type": "boolean"
        },
        "api_audience": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Api Audience"
        },
        "default_locale": {
          "enum": [
            "en",
            "pl"
          ],
          "title": "Default Locale",
          "type": "string"
        },
        "mfa_policy": {
          "enum": [
            "off",
            "optional",
            "required"
          ],
          "title": "Mfa Policy",
          "type": "string"
        },
        "no_tenant_behaviour": {
          "enum": [
            "error",
            "create"
          ],
          "title": "No Tenant Behaviour",
          "type": "string"
        },
        "password_breach_check": {
          "title": "Password Breach Check",
          "type": "boolean"
        },
        "password_min_length": {
          "maximum": 128,
          "minimum": 8,
          "title": "Password Min Length",
          "type": "integer"
        },
        "refresh_token_ttl": {
          "maximum": 31536000,
          "minimum": 3600,
          "title": "Refresh Token Ttl",
          "type": "integer"
        },
        "self_deletion": {
          "title": "Self Deletion",
          "type": "boolean"
        },
        "self_registration": {
          "title": "Self Registration",
          "type": "boolean"
        },
        "session_idle_ttl": {
          "maximum": 7776000,
          "minimum": 60,
          "title": "Session Idle Ttl",
          "type": "integer"
        },
        "session_ttl": {
          "maximum": 7776000,
          "minimum": 3600,
          "title": "Session Ttl",
          "type": "integer"
        },
        "tenant_creator_role": {
          "anyOf": [
            {
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Tenant Creator Role"
        },
        "tenant_mode": {
          "enum": [
            "single",
            "multi"
          ],
          "title": "Tenant Mode",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "patch_member": {
    "operationId": "patch_member",
    "method": "patch",
    "path": "/api/v1/tenants/{tenant_id}/members/{member_id}",
    "tag": "members",
    "summary": "Change a member",
    "description": "Replace a member's roles, change their status, or both.\n\n`roles` replaces the whole set and is audited as `member.roles_changed`; a status change is\naudited as `member.suspended` or `member.unsuspended`. `409 last-owner` when the change would\nleave an Account's tenant without an active owner.",
    "pathParams": [
      "tenant_id",
      "member_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "member_id": {
          "title": "Member Id",
          "type": "string"
        },
        "roles": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Roles",
          "type": "array"
        },
        "status": {
          "enum": [
            "active",
            "suspended"
          ],
          "title": "Status",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "member_id"
      ]
    }
  },
  "patch_permission": {
    "operationId": "patch_permission",
    "method": "patch",
    "path": "/api/v1/permissions/{permission_id}",
    "tag": "permissions",
    "summary": "Describe a permission",
    "description": "Update a permission's description. This is also the one change allowed on a reserved\npermission.",
    "pathParams": [
      "permission_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "permission_id": {
          "title": "Permission Id",
          "type": "string"
        },
        "description": {
          "maxLength": 500,
          "title": "Description",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "permission_id"
      ]
    }
  },
  "patch_role": {
    "operationId": "patch_role",
    "method": "patch",
    "path": "/api/v1/roles/{role_id}",
    "tag": "roles",
    "summary": "Change a role",
    "description": "Update a role's `name` and `description`. The slug cannot be changed.\n\nRenaming a system role is `409 system-role`; changing its description is allowed.",
    "pathParams": [
      "role_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "role_id": {
          "title": "Role Id",
          "type": "string"
        },
        "description": {
          "maxLength": 500,
          "title": "Description",
          "type": "string"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "role_id"
      ]
    }
  },
  "patch_tenant": {
    "operationId": "patch_tenant",
    "method": "patch",
    "path": "/api/v1/tenants/{tenant_id}",
    "tag": "tenants",
    "summary": "Change a tenant",
    "description": "Update a tenant's `name`, `slug` and `metadata`. `metadata` is replaced whole.\n\nThe `slug` of the default tenant cannot change (`422` with `code: \"immutable\"`), and neither can\nthe `slug` of a tenant linked to an Account.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "metadata": {
          "additionalProperties": true,
          "title": "Metadata",
          "type": "object"
        },
        "name": {
          "maxLength": 200,
          "minLength": 1,
          "title": "Name",
          "type": "string"
        },
        "slug": {
          "maxLength": 64,
          "pattern": "^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$",
          "title": "Slug",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "patch_user": {
    "operationId": "patch_user",
    "method": "patch",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}",
    "tag": "users",
    "summary": "Change a user",
    "description": "Update a user's profile (merge patch). The password and the status cannot be changed here.\n\nChanging `email` requires the address to be free in this environment, marks it unverified, and\nemails a verification link, unless the same patch sets `email_verified: true`.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "email": {
          "maxLength": 254,
          "minLength": 1,
          "title": "Email",
          "type": "string"
        },
        "email_verified": {
          "title": "Email Verified",
          "type": "boolean"
        },
        "locale": {
          "anyOf": [
            {
              "enum": [
                "en",
                "pl"
              ],
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Locale"
        },
        "metadata": {
          "additionalProperties": true,
          "title": "Metadata",
          "type": "object"
        },
        "name": {
          "maxLength": 200,
          "title": "Name",
          "type": "string"
        },
        "picture_url": {
          "anyOf": [
            {
              "maxLength": 2000,
              "type": "string"
            },
            {
              "type": "null"
            }
          ],
          "title": "Picture Url"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "put_role_permissions": {
    "operationId": "put_role_permissions",
    "method": "put",
    "path": "/api/v1/roles/{role_id}/permissions",
    "tag": "roles",
    "summary": "Replace a role's permissions",
    "description": "Replace the role's whole permission set, atomically. Audited as `role.permissions_replaced`\nwith the old and new sets.\n\nMembers holding the role get the new permissions in the next token issued for them: within\n`access_token_ttl` for a live access token, and at once on the next refresh. To apply a change\nimmediately, revoke the members' sessions.",
    "pathParams": [
      "role_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "role_id": {
          "title": "Role Id",
          "type": "string"
        },
        "permissions": {
          "items": {
            "format": "uuid",
            "type": "string"
          },
          "title": "Permissions",
          "type": "array"
        }
      },
      "additionalProperties": false,
      "required": [
        "role_id",
        "permissions"
      ]
    }
  },
  "read_account": {
    "operationId": "read_account",
    "method": "get",
    "path": "/api/v1/account",
    "tag": "accounts",
    "summary": "The calling principal's account",
    "description": "The Account the credential was issued for.\n\nA console user who belongs to several Accounts reads the one their token was issued for. One of\nthe two operations (with `GET /me`) still available while the Account is suspended.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "read_api_key": {
    "operationId": "read_api_key",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/api-keys/{api_key_id}",
    "tag": "api-keys",
    "summary": "An API key",
    "description": "The key, without the credential — absent from this shape, not null.",
    "pathParams": [
      "environment_id",
      "api_key_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "api_key_id": {
          "title": "Api Key Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "api_key_id"
      ]
    }
  },
  "read_app": {
    "operationId": "read_app",
    "method": "get",
    "path": "/api/v1/apps/{app_id}",
    "tag": "apps",
    "summary": "An app",
    "description": "The App, with the ids of both its environments.\n\nAn `app_id` that is not a UUID is answered `404`, like a missing App.",
    "pathParams": [
      "app_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "app_id": {
          "title": "App Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "app_id"
      ]
    }
  },
  "read_client": {
    "operationId": "read_client",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/clients/{client_id}",
    "tag": "clients",
    "summary": "A client",
    "description": "The client, without its secret — absent from this shape, not null.",
    "pathParams": [
      "environment_id",
      "client_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "client_id": {
          "title": "Client Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "client_id"
      ]
    }
  },
  "read_environment": {
    "operationId": "read_environment",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}",
    "tag": "environments",
    "summary": "An environment's settings",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "read_environment_stats": {
    "operationId": "read_environment_stats",
    "method": "get",
    "path": "/api/v1/apps/{app_id}/environments/{environment_id}/stats",
    "tag": "environments",
    "summary": "Environment statistics",
    "description": "The environment's overview figures: current totals, a daily series over the range, and setup\nprogress.\n\nCached for 60 seconds per environment and range; `computed_at` is when the figures were\ncomputed.",
    "pathParams": [
      "app_id",
      "environment_id"
    ],
    "queryParams": [
      "range"
    ],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "app_id": {
          "title": "App Id",
          "type": "string"
        },
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "range": {
          "default": "7d",
          "enum": [
            "7d",
            "30d",
            "90d"
          ],
          "title": "Range",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "app_id",
        "environment_id"
      ]
    }
  },
  "read_member": {
    "operationId": "read_member",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}/members/{member_id}",
    "tag": "members",
    "summary": "A member",
    "pathParams": [
      "tenant_id",
      "member_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "member_id": {
          "title": "Member Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "member_id"
      ]
    }
  },
  "read_permission": {
    "operationId": "read_permission",
    "method": "get",
    "path": "/api/v1/permissions/{permission_id}",
    "tag": "permissions",
    "summary": "A permission",
    "pathParams": [
      "permission_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "permission_id": {
          "title": "Permission Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "permission_id"
      ]
    }
  },
  "read_role": {
    "operationId": "read_role",
    "method": "get",
    "path": "/api/v1/roles/{role_id}",
    "tag": "roles",
    "summary": "A role",
    "description": "One role.\n\nA tenant member may read its own tenant's roles here and nothing else: an app-scoped role or\nanother tenant's role is `403 insufficient-scope`. Use `GET /tenants/{tenant_id}/roles` to list\nthe app-scoped roles a tenant member can assign.",
    "pathParams": [
      "role_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "role_id": {
          "title": "Role Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "role_id"
      ]
    }
  },
  "read_tenant": {
    "operationId": "read_tenant",
    "method": "get",
    "path": "/api/v1/tenants/{tenant_id}",
    "tag": "tenants",
    "summary": "A tenant",
    "description": "The tenant, including the default one, which is addressable by id in both modes.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "read_usage": {
    "operationId": "read_usage",
    "method": "get",
    "path": "/api/v1/account/usage",
    "tag": "accounts",
    "summary": "Account usage",
    "description": "Users per App and per environment, and the App count against the plan's limit.\n\nSandbox environments are reported but never counted toward a limit. Not available while the\nAccount is suspended.",
    "pathParams": [],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false
    }
  },
  "read_user": {
    "operationId": "read_user",
    "method": "get",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}",
    "tag": "users",
    "summary": "A user",
    "description": "The user, including an erased one — so an audit reference still resolves.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "remove_member_operation": {
    "operationId": "remove_member_operation",
    "method": "delete",
    "path": "/api/v1/tenants/{tenant_id}/members/{member_id}",
    "tag": "members",
    "summary": "Remove a member",
    "description": "Remove the row and revoke that user's sessions bound to this tenant.\n\nThe one write a `tenant_member` may make against its own Member row: a\nperson may always leave.",
    "pathParams": [
      "tenant_id",
      "member_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "member_id": {
          "title": "Member Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "member_id"
      ]
    }
  },
  "resend_invitation_operation": {
    "operationId": "resend_invitation_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/invitations/{invitation_id}/resend",
    "tag": "invitations",
    "summary": "Re-send an invitation",
    "description": "Issue a new invitation link, valid for seven days, and email it.\n\nThe previous link stops working immediately. Limited to one resend a minute and five an hour per\ninvitation.",
    "pathParams": [
      "tenant_id",
      "invitation_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "invitation_id": {
          "title": "Invitation Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "invitation_id"
      ]
    }
  },
  "revoke_all_environment_sessions": {
    "operationId": "revoke_all_environment_sessions",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/sessions/revoke-all",
    "tag": "environments",
    "summary": "Revoke every session in the environment",
    "description": "Revoke every session and every refresh token in the environment.\n\nFor use after a signing key compromise, together with a signing key rotation that retires the\nold key immediately. Access tokens already issued remain valid until they expire, so keep\n`access_token_ttl` short if you need an immediate cut-off.",
    "pathParams": [
      "environment_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id"
      ]
    }
  },
  "revoke_all_user_sessions": {
    "operationId": "revoke_all_user_sessions",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/sessions/revoke-all",
    "tag": "users",
    "summary": "Revoke all of a user's sessions",
    "description": "Revoke every live session of the user, and their refresh tokens.\n\n`revoked` counts the sessions that were live at the time, so a second call answers `{\"revoked\":\n0}`.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "revoke_api_key_operation": {
    "operationId": "revoke_api_key_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/api-keys/{api_key_id}/revoke",
    "tag": "api-keys",
    "summary": "Revoke an API key",
    "description": "Revoke an API key, keeping its record. Idempotent.\n\nThe key stops working immediately. Revoking a revoked key answers `200` with the same key, and\nrecords no second event. `404` when the key is deleted while the request is being processed.",
    "pathParams": [
      "environment_id",
      "api_key_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "api_key_id": {
          "title": "Api Key Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "api_key_id"
      ]
    }
  },
  "revoke_invitation_operation": {
    "operationId": "revoke_invitation_operation",
    "method": "delete",
    "path": "/api/v1/tenants/{tenant_id}/invitations/{invitation_id}",
    "tag": "invitations",
    "summary": "Revoke an invitation",
    "description": "Revoke an invitation, so its link stops working. Idempotent.\n\nThe invitation is kept, and listed under `?status=revoked`.",
    "pathParams": [
      "tenant_id",
      "invitation_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        },
        "invitation_id": {
          "title": "Invitation Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id",
        "invitation_id"
      ]
    }
  },
  "rotate_api_key_operation": {
    "operationId": "rotate_api_key_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/api-keys/{api_key_id}/rotate",
    "tag": "api-keys",
    "summary": "Rotate an API key",
    "description": "Issue a new secret for an API key, returned once. Takes no body.\n\nThe key keeps its id, name, scopes and audit history. The previous secret stops working\nimmediately; there is no overlap. A revoked or expired key is `409 api-key-not-rotatable`;\ncreate a new key instead. `404` when the key is deleted while the request is being processed.",
    "pathParams": [
      "environment_id",
      "api_key_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "api_key_id": {
          "title": "Api Key Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "api_key_id"
      ]
    }
  },
  "rotate_client_secret": {
    "operationId": "rotate_client_secret",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/clients/{client_id}/rotate-secret",
    "tag": "clients",
    "summary": "Rotate a client secret",
    "description": "Issue a new secret for a `web` client, returned once. Takes no body.\n\nThe previous secret stops working at `/oauth/token` immediately; there is no overlap. A `spa` or\n`native` client has no secret: `409 client-not-confidential`.",
    "pathParams": [
      "environment_id",
      "client_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "client_id": {
          "title": "Client Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "client_id"
      ]
    }
  },
  "send_password_reset_operation": {
    "operationId": "send_password_reset_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/send-password-reset",
    "tag": "users",
    "summary": "Send a password reset email",
    "description": "Email the user a password reset link, the same one the hosted forgot-password page sends.\n\nEarlier unused reset links stop working. A blocked user is sent nothing, but the request is\nstill audited.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "send_verification_operation": {
    "operationId": "send_verification_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/send-verification",
    "tag": "users",
    "summary": "Send a verification email",
    "description": "Email the user a link to verify their address, within the per-user email budget.\n\nFor an address that is already verified, nothing is sent and nothing is counted against the\nbudget, and the answer is `{\"sent\": false}`. `{\"sent\": true}` means one message was sent.\n\nThe budget is shared by this operation, `send-password-reset` and the hosted pages' resend form.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "set_user_password": {
    "operationId": "set_user_password",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/password",
    "tag": "users",
    "summary": "Set a user's password",
    "description": "Set a new password for the user, without the old one.\n\nAnswers `204`. Every session and refresh token of the user is revoked, and the user is emailed\nto say their password was changed. Not available to a tenant member's token: `403\ninsufficient-scope`, even with `users:write`.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": true,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        },
        "password": {
          "title": "Password",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id",
        "password"
      ]
    }
  },
  "suspend_tenant_operation": {
    "operationId": "suspend_tenant_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/suspend",
    "tag": "tenants",
    "summary": "Suspend a tenant",
    "description": "Stop the tenant from being selected at sign-in. Idempotent.\n\nNothing is revoked: access tokens already issued remain valid until they expire, and the next\ntoken issued for a session bound to this tenant carries no `tenant` claim. A tenant linked to an\nAccount cannot be suspended: `409 account-tenant`.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
  "unblock_user_operation": {
    "operationId": "unblock_user_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/unblock",
    "tag": "users",
    "summary": "Unblock a user",
    "description": "Let the user sign in again. The sessions blocking ended stay ended.\n\nIdempotent: unblocking an active user is 200 with no second event.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "unlock_user_operation": {
    "operationId": "unlock_user_operation",
    "method": "post",
    "path": "/api/v1/environments/{environment_id}/users/{user_id}/unlock",
    "tag": "users",
    "summary": "Clear a user's lockout",
    "description": "Reset the user's failed sign-in count and lift any lockout.\n\nA lockout's expiry does not reset the failed sign-in count; only a successful sign-in, a\npassword reset or this operation does. A block is a different state and is not affected.",
    "pathParams": [
      "environment_id",
      "user_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "environment_id": {
          "title": "Environment Id",
          "type": "string"
        },
        "user_id": {
          "title": "User Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "environment_id",
        "user_id"
      ]
    }
  },
  "unsuspend_tenant_operation": {
    "operationId": "unsuspend_tenant_operation",
    "method": "post",
    "path": "/api/v1/tenants/{tenant_id}/unsuspend",
    "tag": "tenants",
    "summary": "Unsuspend a tenant",
    "description": "Put the tenant back in the candidate set. Idempotent.",
    "pathParams": [
      "tenant_id"
    ],
    "queryParams": [],
    "hasBody": false,
    "inputSchema": {
      "type": "object",
      "properties": {
        "tenant_id": {
          "title": "Tenant Id",
          "type": "string"
        }
      },
      "additionalProperties": false,
      "required": [
        "tenant_id"
      ]
    }
  },
}
