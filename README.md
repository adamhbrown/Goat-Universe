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

Local development uses persistent PostgreSQL through PGlite and local password
authentication. Hosted environments use Supabase Auth and the exact same SQL
business migrations. Local authentication is blocked in production.

See [backend operations](docs/BACKEND.md), [checkpoint](docs/CHECKPOINT.md), and
[source and rules register](docs/SOURCES_AND_RULES.md).

This is a tested development foundation. Hosted Supabase authentication, email
delivery, and production deployment still require environment configuration and
verification. Commercial drafts are stored for review; no outbound sender exists.
