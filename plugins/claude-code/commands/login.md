---
description: Authorise this agent against your Kleora account (opens a browser sign-in) and report who it is acting as.
---

## Your task

Sign this session in to Kleora and report the result. Do not ask the user for
a password, an API key or a token at any point — there is nothing for them to
paste, and asking would be the wrong instinct to teach.

1. Call `kleora_whoami`.

2. **If it answers with a verification URL and a code**, that is the sign-in,
   not an error. Show both clearly, on their own lines, and tell the person:

   - open the URL and sign in as themselves;
   - check that the code shown in the browser matches the one printed here
     before approving — the link is a convenience, the code is the consent;
   - they will be asked to re-authenticate even if they are already signed in,
     because approving an agent's access requires it;
   - say "done" here when they have approved.

   Then call `kleora_whoami` again. If it still reports that authorization is
   required, wait for them rather than polling in a loop. If the approval was
   denied, say so plainly and stop.

3. **When it succeeds**, report in three short lines:

   - the account, and the user this agent is now acting as;
   - the permissions that user holds, summarised — and name anything obviously
     missing for the work at hand rather than discovering it later;
   - that this is a named, revocable authorization: it appears beside their
     other sessions in the console, revoking it there stops this agent at its
     next call, and `/kleora:logout` ends it from here.

4. Then list the Apps (`kleora_apps_list`) and, for the one they are working
   on, its environments (`kleora_app_environments_list`), stating which id is
   sandbox and which is production. Every later call needs an explicit
   environment id, so having both to hand — and knowing which is which — is
   what keeps a sandbox change from landing in production.
