# Moneylix — Go-Live Checklist

Compiled from `MONEYLIX_PROJECT_DOCUMENT.md` §13 plus a working-copy audit on 2026-09-07
(local run, production build, and env inspection). Check items off as you verify them
against the actual production server — this local copy is missing most secrets, so
several items may already be done there.

## 1. Blockers (must fix before deploy)

- [x] **Production build compiles** — `next build` was failing on a TypeScript error in
      `src/app/dashboard/calendar/page.tsx` (`for...of` over a `Map`). Fixed by switching
      to `.forEach()`. Re-run `npm run build` on the deploy target to confirm it's clean there too.
- [ ] **Rotate the leaked Gemini API key.** `.env.example` has a real key hardcoded as its
      "default" value (should be a placeholder) — same key is in this `.env.local`. If this
      repo is or becomes public, that key is exposed. Rotate it in Google AI Studio and
      replace the value in `.env.example` with a placeholder.
- [ ] **Confirm `.env.local` on the live server** has all of the following set (this local
      copy only has `GEMINI_API_KEY`):
  - [ ] `NEXT_PUBLIC_APP_URL` → `https://moneylix.in`
  - [ ] `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (live keys, not test)
  - [ ] `RAZORPAY_WEBHOOK_SECRET`
  - [ ] `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
  - [ ] `TOKEN_ENCRYPTION_KEY` (32-byte base64, unique per environment)
  - [ ] `SETU_AA_CLIENT_ID` / `SETU_AA_CLIENT_SECRET` / `SETU_AA_FIU_ID` / `SETU_AA_BASE_URL=https://api.setu.co` (production, not sandbox)
  - [ ] `CRON_SECRET` (without it, cron endpoints accept unauthenticated calls)
  - [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limiting)

## 2. Payments (Razorpay)

- [ ] Live keys (not test keys) in server `.env.local`
- [ ] Webhook endpoint registered in Razorpay dashboard → `/api/payments/webhook`
- [ ] Webhook secret set and signature verification tested with a real event
- [ ] At least one real payment run end-to-end (checkout → webhook → plan upgrade email)

## 3. Email (Resend)

- [ ] `RESEND_API_KEY` set
- [ ] Sending domain verified in Resend (for `noreply@moneylix.in`, not `resend.dev`)
- [ ] Test each trigger fires correctly: welcome, email verification, password reset,
      plan upgrade, weekly recap (cron)

## 4. Bank Sync (Setu Account Aggregator)

- [ ] Setu credentials are production (not sandbox) values
- [ ] `SETU_AA_BASE_URL` points at `https://api.setu.co`, not sandbox
- [ ] Webhook secret set for AA callbacks
- [ ] RBI audit logging (`audit_logs` table, `src/lib/audit.ts`) confirmed writing on the live DB

## 5. Auth & Admin

- [ ] Admin account password: the app auto-generates a random per-install password on
      first boot (`src/lib/db.ts`, `seedAdminUser`) and prints it once to server logs —
      confirm that password was captured and stored securely, not left in scrollback
- [ ] Demo login (`/api/auth/demo`, "Instant Demo Access" button) — decide whether this
      should be disabled or gated in production; it currently grants an unauthenticated
      session to the shared demo account
- [ ] Session/cookie config reviewed (JWT 7-day expiry per docs) — acceptable for launch

## 6. Database

- [ ] Confirm SQLite (`moneylix.db`, WAL mode) is the intended production DB for launch
      scale, or whether the Postgres cutover (`db.postgres.ts`, prepped but unused) is needed first
- [ ] Backup strategy in place for `moneylix.db` (file-based DB — no managed backups by default)
- [ ] Migration runner (`src/migrations/*.sql`) applies cleanly on a fresh copy of the prod DB

## 7. Infra / Deployment

- [ ] SSL certificate valid (doc notes Let's Encrypt, expiry 2026-08-06 — check it hasn't lapsed)
- [ ] Nginx reverse proxy config (443 → localhost:3006) confirmed live
- [ ] `pm2` process running and set to restart on boot (`pm2 save`)
- [ ] Deploy command works clean: `git pull && npm run build && pm2 restart moneylix`
- [ ] Internal cron scheduler (`check-notifications` 6h, `process-recurring` 1h,
      `expire-subscriptions` 24h) confirmed running under pm2, not just in local dev

## 8. Security

- [ ] Rotate leaked Gemini key (see Blockers)
- [ ] `TOKEN_ENCRYPTION_KEY` is unique to production, not reused from dev/staging
- [ ] Rate limiting (Upstash) active on public/auth endpoints
- [ ] Zod validation confirmed on all API inputs (per docs — spot check a few routes)
- [ ] `.env.local` never committed; `.env.example` contains only placeholders

## 9. Legal / Compliance

- [x] Privacy policy, terms, and cookie policy pages exist (`/privacy`, `/terms`, `/cookie-policy`)
- [ ] Content in those pages reviewed for accuracy (company name, data practices, contact info)
- [ ] Cookie consent banner behavior verified (appears once, persists dismissal)

## 10. Testing (currently missing)

- [ ] No automated test suite exists (`package.json` has no `test` script) — at minimum,
      manually walk the golden path before each deploy: register/login → add transaction →
      create invoice → run a payment → check dashboard numbers update
- [ ] `npm run lint` passes clean

## 11. Mobile (only if shipping iOS/Android with this release)

- [ ] iOS App Store listing (description, screenshots) completed and submitted
- [ ] Android APK built, uploaded to Play Store, listing filled, submitted

## Not blocking for launch (documented future work)

- Push notifications for receivable due dates
- PDF export for reports
- Multi-currency conversion
- Tax/GST calculation module
- Postgres cutover (SQLite is fine to start)
