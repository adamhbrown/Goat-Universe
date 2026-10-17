# POPE API ABUSE GATE — local development hardening

October 15, 2026 · draft only · no production configuration changes

## Change and threat model

The existing `backend/server.mjs` cleaned its entire per-client rate table
on **every** POST, and separately allocated an authentication counter for each
client. That adds unnecessary O(n) CPU work per POST and extra entries as
the site grows.

`backend/security/request-limiter.mjs` replaces it with **one bounded entry
per socket peer** and two independent counters:

| Counter | Default | Key |
| --- | ---: | --- |
| POST requests | 120 / 60 seconds | real TCP peer IP |
| Auth submissions | 10 / 60 seconds | same peer IP |
| Clients retained | at most 10,000 | fixed bounded map |

Expired entries are swept at most once every ten seconds, not once per request.
When capacity is exhausted, a new source is denied with HTTP 429 instead of
increasing memory use. A client already registered in the table can continue
until its individual quota expires. Unknown peers share one conservative key.

We intentionally **do not trust `X-Forwarded-For`** because the current
backend has no approved trusted-proxy chain configuration. Anyone can forge
that header. Tests send different forged addresses and verify that the
ten-attempt limit still works. Existing no-store, CSP, origin, JSON-only,
payload size and bearer-token protections remain unchanged.

## Integration boundaries

This change is isolated on `work/pope-bounded-api-abuse-protection-20261015`
stacked on the five-game candidate audit. Merge only after the account,
competition and Bullpen server variants have been reconciled, because those
draft branches may also edit `backend/server.mjs`.

**Important limitations before hosting:**

- Counters are **in memory and per Node process**. An actual multi-instance
  edge/backend deployment requires a shared Redis/gateway/cloud rate limiter.
- Socket-peer keys behind a reverse proxy may identify the proxy, not the
  visitor. Production requires a **trusted gateway** to determine client
  identity, prevent spoofing and support shared budgets. Do not simply use
  request-provided forwarding headers.
- A shared-IP budget can throttle users behind campuses or household NAT.
  Evaluate real traffic and gateway controls before finalizing these defaults.
- Limits are a coarse abuse floor, not a replacement for per-account throttling,
  password protections, monitoring, DDoS controls, or financial fraud checks.
- Do not enable payments, prize claims, bulk mail or public registration on
  this change. A passed synthetic test is not hosted security validation.

## Testing

`backend/test/request-limiter.test.mjs` checks capacity, clock rollover,
independent request and auth budgets, unknown peers, and configuration errors.

`backend/test/http-abuse.test.mjs` launches the real local backend in an
isolated temporary directory and exercises origin rejection, read-only headers,
JSON-only requests, anonymous data denial, 32-KiB payload limits, forged
forwarded-IP authentication floods and continued access to the public catalog.

Local command:

```bash
npm ci --ignore-scripts
node --test backend/test/request-limiter.test.mjs backend/test/http-abuse.test.mjs
npm test
```

No hosted Supabase project, secrets, production deployment or database
migration is touched. Every change requires ordinary code review and explicit
CEO release authorization.
