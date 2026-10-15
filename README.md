# GOAT Universe backend development

The existing public `index.html` is preserved. Backend work is isolated on
`codex/backend-foundations`; this branch does not deploy the public Pages site.

```sh
npm ci --ignore-scripts
npm test
npm run dev
```

Node 24 is used in CI. The existing participant portal is
`http://localhost:8787/play`; the extended commissioner/commercial workspace is
`http://localhost:8787/manage`. Database health is `http://localhost:8787/health`;
the advanced JSON API console remains at `http://localhost:8787/admin`.

The portal has real local registration, login, profile editing, invitation
requests, private competition dashboards, pick forms, standings/history,
commissioner controls, researched leads, draft review and approval. NFL LXI
draft setup creates four rounds atomically and keeps rules unapproved until
review. Tests exercise HTTP, PostgreSQL access policies and real DOM form
handlers; DOM tests do not replace desktop/mobile visual browser acceptance.

The development server now serves two responsive interfaces:

- GOAT Games player portal: http://localhost:8787/play
- Internal commercial HQ: http://localhost:8787/crm
- Technical administration console: http://localhost:8787/admin

Both portals use the existing authenticated API. The commercial desk is role-gated; it saves drafts for human approval but cannot send messages. No payments are activated. None of these are yet published to the public GitHub Pages website.

Local development uses persistent PostgreSQL through PGlite and local password
authentication. Hosted environments use Supabase Auth and the exact same SQL
business migrations. Local authentication is blocked in production.

See [backend operations](docs/BACKEND.md), [checkpoint](docs/CHECKPOINT.md), and
[source and rules register](docs/SOURCES_AND_RULES.md).

This is a tested development foundation. Hosted Supabase authentication, email
delivery, and production deployment still require environment configuration and
verification. Commercial drafts are stored for review; no outbound sender exists.
