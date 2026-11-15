---
allowed-tools: Bash(node:*)
description: End this agent's Kleora authorization and delete the stored credential from this machine.
---

## Your task

Sign this machine out of Kleora: revoke the authorization at the issuer, then
delete the stored credential. Run this before uninstalling the plugin —
uninstalling removes the plugin's files and nothing else, so the credential and
the grant would otherwise outlive it.

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/server/kleora-mcp.mjs" --logout \
  --base-url="${CLAUDE_PLUGIN_OPTION_API_BASE_URL:-https://api.kleora.io}" \
  --profile="${CLAUDE_PLUGIN_OPTION_PROFILE:-default}"
```

If this plugin was configured with a different management API base URL or a
different profile than those defaults, pass the configured values instead — the
command must address the same profile the server uses, or it will report that
there was nothing to remove while the real credential stays where it is.

Then report exactly what the command said, without softening it:

- **Revoked and deleted** — nothing on this machine can reach the account any
  more. The next tool call will start a fresh sign-in.
- **Deleted but not revoked** (the issuer could not be reached, or refused) —
  the local copy is gone, but the grant may still be live. Tell them to revoke
  it in the console, where it is listed beside their other sessions. Do not
  describe this as a clean sign-out.
- **Nothing stored** — this profile was not signed in. Say so, and mention that
  another profile may still hold a credential if they configured one.

Finally: the plugin's own MCP connection stays running in this session. Any
further Kleora tool call will begin a new device authorization, which is the
correct behaviour — not a failure of the sign-out.
