# GOAT Universe backend development

The existing public `index.html` is preserved. Backend work is isolated on
`codex/backend-foundations`; this branch does not deploy the public Pages site.

```sh
npm ci --ignore-scripts
npm test
npm run dev
```

Node 24 is used in CI. The local API and administrative console run at
`http://localhost:8787/health` and `http://localhost:8787/admin`.

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
