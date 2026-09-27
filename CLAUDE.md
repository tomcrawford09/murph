# CLAUDE.md – Murph in Progress

Personal side quest: a phone-first Murph volume logger for Tom and invited friends. Read [README.md](README.md) for architecture and commands, [PLAN.md](PLAN.md) for the product rules and release checks, [CONTEXT.md](CONTEXT.md) for vocabulary.

## Rules

- **The repository is public.** Never commit a Supabase secret or service-role key, access token, database password, OAuth client secret, anyone's email address or exercise data. The publishable key in `config.js` is designed to be public; row-level security protects the data.
- Keep it dependency-free: plain HTML/CSS/JS, no framework, no bundler. `vendor/supabase.js` is a pinned copy; upgrade it deliberately and re-run the tests.
- Every change to local entries goes through `mutate()` in `app.js`, so writes are serialised against the latest state. Deletion is one-way on phone and server; never add an "undelete".
- The strict CSP in `_headers` means no inline scripts and no inline `style` attributes. Set styles through the DOM.
- Schema changes go in a new file in `supabase/migrations/`, then apply it and rerun `tests/rls-e2e.mjs` before relying on it.
- Human-facing copy uses en dashes, never em dashes.

## Accounts (no secrets here)

- Supabase project ref `zrsnigcaiokfroqggjku` (region ap-northeast-2), managed from Tom's Supabase account. Local-only credentials live in the workspace `.secrets/` folder on Beast (`supabase-murph.token`, `murph-supabase-secret.key`).
- Cloudflare Pages project `murph-in-progress` on Tom's personal Cloudflare account; `main` is the production branch.
- Google OAuth client in Tom's personal Google Cloud account; redirect URI `https://zrsnigcaiokfroqggjku.supabase.co/auth/v1/callback`.
