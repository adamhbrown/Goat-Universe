# Account activation and recovery — development handoff

The account portal now includes confirmation and recovery callbacks, recovery
requests and authenticated password changes. Local changes use the current
password and revoke all sessions/refresh tokens atomically. Hosted changes
reauthenticate the session owner, update through the user's token, and request
Supabase global sign-out. Recovery verifies the one-time recovery hash, changes
the password and globally revokes sessions. Neither confirmation nor reset
returns access/refresh tokens to the browser.

## Boundaries

- `AUTH_EMAIL_ENABLED=false` by default. No confirmation/recovery emails were
  sent during development. Supabase email-producing requests fail closed until
  deliberately enabled after setup. This flag is separate from payments.
- Local development has no email provider or fake recovery token; it reports
  that recovery email is unavailable. Authenticated local password changes work.
- GET `/auth/callback` renders only. An explicit POST confirms email or resets
  a password, so ordinary email-link prefetch does not consume a token.
- Callback tokens are removed from the browser URL and retained only in a module
  closure. Browser storage is not used. Redirect destinations are server-fixed;
  caller-provided redirects, user IDs and roles are ignored.
- Default Supabase implicit-flow links are intentionally unsupported by this
  callback. Configure the custom token-hash templates below before enabling
  email flows. Do not claim production signup/recovery works before testing it.
- Application tables check live Supabase sessions, so revoked session rows deny
  sensitive reads even while a cryptographic JWT has not yet expired.

## Dedicated development environment setup

1. Use a **separate healthy development project**. The existing project
   `opvoemihfyxidzbdyory` is protected and still reports `COMING_UP`.
2. Apply the existing development migrations through the approved dry-run/apply
   process. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` and
   `BACKEND_MODE=supabase`. Keep production and live payment flags false.
3. Configure Auth Site URL and the exact redirect allowlist to include
   `https://<development-app-host>/auth/callback`. The repository's local Auth
   config contains the localhost and 127.0.0.1 callback paths.
4. Configure a transactional email provider and sender. Any provider expense or
   external commitment requires Adam's approval. Keep email confirmations on.
5. Update the **Confirm signup** and **Reset password** templates. Their action
   links should go directly to this application callback, putting the hash in
   the fragment so gateway query logs do not receive it:

Confirm signup link:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=signup">Confirm email</a>
```

Reset password link:

```html
<a href="{{ .RedirectTo }}#token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

`signup` is an application callback label. The server uses the currently
recommended Supabase `email` verification type for confirmation; reset uses
`recovery`. It does not expose arbitrary verification types to clients.
Do not add click-tracking rewrites that leak these one-time hashes. Exclude
password/token-bearing request bodies and callback query strings from gateway,
error-reporting and analytics logs.

6. After reviewing templates/provider/redirects, enable `AUTH_EMAIL_ENABLED=true`
   on development only. Test emails only to Adam-approved test inboxes.

## Hosted acceptance checklist

- Signup sends confirmation to the approved inbox. Before confirmation,
  password login/member RPCs cannot access private data.
- GET/prefetch of the email callback makes no account change. Explicit button
  submission confirms once; expired/reused hashes fail without issuing sessions
  to the browser. User then signs in normally.
- Recovery gives the same acknowledgement for registered and unknown addresses.
  The callback rejects implicit access/refresh tokens and arbitrary redirects.
- Reset validates repeated password, changes credentials and revokes old sessions.
  Old access and refresh tokens fail via application API **and direct Data API**.
- Password change rejects wrong current credentials, cannot change another user,
  revokes all devices, and requires a fresh login.
- Verify throttling, provider delivery/rate limits, mobile keyboard/autocomplete,
  accessibility and failure/retry flows in real desktop/mobile browsers.

## Read-only deployment check

```sh
npm run check:deployment
```

This does not register accounts, send email, apply migrations, change settings or
activate payments. It validates schema-v4 health and anonymous RPC denial.
Optionally supply `GOAT_ACCEPTANCE_ACCESS_TOKEN` securely for an already-confirmed
**ordinary member** on the dedicated project; the script also checks Auth,
actor-bound profile RPC/direct-table reads and denied executive access. Reports
contain check names/status, never keys, tokens or member identifiers.

Exit codes: 0 passed, 1 failed, 2 blocked/incomplete. A clean read-only preflight
still leaves email flows, revoked-session tests and browser acceptance pending.
The current environment reports **blocked: missing SUPABASE_URL,
SUPABASE_PUBLISHABLE_KEY and hosted APP_ORIGIN**; hosted checks have not run.

Primary documentation reviewed:

- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/reference/javascript/auth-verifyotp
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/server-side/advanced-guide

## Manual development schema workflow

`.github/workflows/supabase-development-apply.yml` prepares the development-only
migration operation. It has **no push trigger** and has not been dispatched.
After the dedicated project and protected development environment credentials
exist, a reviewed manual run must set the apply checkbox and type the exact
project reference. Guards reject main/other branches, the existing production
project, mismatches and absent credentials. It runs tests and a dry run before
applying development migrations, skips Vault settings, then performs read-only
schema/anonymous-access checks. It does not launch the app, configure email,
activate billing or deploy production. Remaining acceptance checks are printed.

Required GitHub `development` environment values: variables
`SUPABASE_DEV_PROJECT_REF` and `GOAT_DEV_APP_ORIGIN` (exact HTTPS origin); secrets `SUPABASE_ACCESS_TOKEN`,
`SUPABASE_DEV_DB_PASSWORD`, and `SUPABASE_DEV_PUBLISHABLE_KEY`.
Environment reviewer protection must be configured/verified by the owner; this
code does not assume an existing approval rule. The previous Actions token 401
must be resolved separately. No secrets were created or rotated by this batch.

GitHub requires a `workflow_dispatch` workflow to be registered on the default
branch before it can be dispatched for another ref. This new workflow is still
on the development branch: a reviewed merge of the workflow file (without
changing the public site) is also required before it appears as a runnable
Actions operation. That merge has not been performed.

## Launch-readiness follow-up

Both `/play` and `/manage` now expose recovery requests and use the same
in-memory session client. Safari pagehide clears typed login passwords, tokens
and private panels before back/forward caching. This deliberately requires a
new login after page navigation; no persistent browser session was introduced.
The hosted preflight now requires an exact HTTPS `APP_ORIGIN` as well as the
dedicated URL and publishable key. See `LAUNCH_READINESS.md` for current evidence
and `HOSTED_DEVELOPMENT.md` for the prepared hosting process.
