# Dollar Price — Web repository instructions

This repository is the public Web application. It is independently deployed from `worker_server-main` and shares Supabase with it.

## Local paired checkouts

On this machine, this conversation can work with both independent checkouts:

- Web: `C:/Users/LEVEL UP/.codex/worktrees/e2fc/Dollar-main` -> `https://github.com/Moatezsager/Dollar.git`.
- Worker: `C:/Users/LEVEL UP/Projects/Dollar-Price/worker_server-main` -> `https://github.com/Moatezsager/worker_server.git`.

Worker was cloned independently from its default `main` branch. Local availability does not mean its runtime or integration has been reviewed. Read its own `AGENTS.md` before changes. Re-check paths and remotes on another machine or after moving a checkout.

For each task, use the target project's working directory (or `git -C <project-path>`). Fetch, stage, commit, and push each repository separately, after verifying its `origin` and branch. Never put Worker files inside Web or Web files inside Worker. Do not copy environment files or credentials between projects. Keep Worker outside Web's managed worktree; do not move either checkout without an explicit request.

## System context supplied by the owner

Dollar Price is one system with two independent repositories and Render services:

- **Web**: `Dollar-main`, https://github.com/Moatezsager/Dollar. Owns public React UI/PWA, displaying prices, Web APIs, Socket.IO, Web administration and visitor features.
- **Worker**: `worker_server-main`, https://github.com/Moatezsager/worker_server. Owns external price collection (CBL, Telegram and WhatsApp where implemented), validation/processing, Supabase price updates, scheduled jobs, automated publishing and notifications to Web. It also has a separate private administration/monitoring dashboard that must be preserved.
- Supabase is shared. Authenticated internal HTTP calls can connect the services in addition to their database integration.
- The owner confirms visitor Web Push is sent by Web only, not Worker. Keep one Web price-notification pipeline; do not add another sender in Worker.

Intended price flow:

```text
CBL / Telegram / WhatsApp -> Worker -> validate/process -> Supabase
Supabase -> Web -> Socket.IO -> React visitors (no page reload)
```

Worker responsibilities above are owner-provided context, not confirmation that its implementation has been inspected. A repository URL does not imply local access. Verify Worker files and deployed configuration before claiming both sides of a contract match.

## Confirmed in the current Web code

- `server.ts` initializes database/config state and Socket.IO, then reloads current prices and broadcasts them on startup. `server/app.ts` mounts Web routes, including `/api/admin` with `requireAdmin` after login routes (`server/routes/admin/index.ts`).
- `server/db.ts` creates the server Supabase client from `VITE_SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY`, required in production. Development may fall back to the anon key. Browser code keeps the anon key separately; never put privileged secrets in `VITE_*` variables. Local SQLite remains independent.
- `server/services/db.service.ts` reads `parallel_rates` and `official_rates`, with `exchange_rates` fallback in the broader initialization/history paths. History also reads `metal_rates`. Preserve fields including `usd`, `rates`, `recorded_at`, `last_changed`, and legacy `rates_parallel`/`rates_official` where used. Config is loaded from `app_config` (`server/config.ts`).
- Web is not entirely read-only: it stores visitor/admin data and retains manual price writes and legacy extraction, Telegram and publishing helpers. `server/routes/admin/rates.routes.ts` still handles manual extraction/persistence; `server/services/social.service.ts` forwards contact messages to Telegram. Do not remove these paths merely because background price collection belongs to Worker.
- `server/schedulers/cron.scheduler.ts` does not schedule price collection. `tasks.scheduler.ts` only sets up visitor-log cleanup and a local health request. The Web `/api/refresh-parallel` and `/api/refresh-official` legacy routes return HTTP 503 with Worker job hints; they are not active collection jobs.
- Public prices use Web HTTP and Socket.IO, not a direct Supabase realtime subscription in the inspected price path. `src/lib/supabase.ts` defines a browser client, but that alone does not establish a realtime subscription.

## Visible integration contracts

These are Web-side contracts, not verified Worker implementations. Inspect both repositories before renaming routes, headers, events or payload fields.

| Direction | Contract visible in Web |
| --- | --- |
| Worker -> Web | `POST /api/internal/notify-rates-updated` in `server/app.ts`. Uses `WORKER_INTERNAL_SECRET`; accepts `x-worker-secret` or `Authorization: Bearer ...`. Missing authentication returns 401; a mismatch returns 403. No request-body fields are consumed. HTTP 200 `{status: "accepted"}` is sent **before** reloading Supabase and broadcasting, so it is acknowledgement, not proof of completed synchronization. |
| Web -> Worker price jobs | `POST /api/admin/refresh` calls `POST ${WORKER_URL}/internal/jobs/refresh`; `POST /api/admin/refresh-official` calls `/internal/jobs/cbl`. Both use `x-worker-secret: WORKER_INTERNAL_SECRET`, a 10-second timeout and accept Worker HTTP 200/202 (`server/routes/admin/rates.routes.ts`). |
| Web -> Worker WhatsApp | `/api/admin/whatsapp/status` and `/qr` use GET; `/init` and `/disconnect` use POST. Proxied to `${WORKER_SERVER_URL}/api/whatsapp/{status,qr,init,disconnect}` with `X-Worker-Secret: WORKER_INTERNAL_SECRET` (`server/routes/admin/whatsapp.routes.ts`). |
| Web -> public React | `GET /api/rates`, `/api/history` and `/api/config`, plus same-origin Socket.IO (`io('/')`). HTTP prices/history are encoded; `rates_update` carries `{rates: obfuscateData(Rates)}`. Decode with the existing helpers, not a new incompatible format. |

`WORKER_URL` and `WORKER_SERVER_URL` are separate names in current Web code; do not assume either automatically supplies the other. Verify both service environments and the matching shared secret without printing values.

Server-side fetch calls to `/api/` must send a descriptive User-Agent: `Dollar-Price-Web/1.0` for Web requests and `Dollar-Price-Worker/1.0` for Worker notifications. Node's default `node` fails the existing User-Agent length check. This header does not replace authentication. Paired Worker integration tests exercise the real middleware with the actual notification sender and WhatsApp proxy.

### Realtime and cache behavior

- Historical record corrections in Web update both `rates.USD` and `usd` for USD without changing the observation time. Older-record edits must not publish a new current social price. Successful record edits/deletions send Web-only `history_update` with encoded authoritative history and `readStartedAt`; clients replace cached history, preserving live observations newer than that read. This is separate from `rates_update` and does not trigger per-visitor polling or Worker jobs.
- `/api/history` now uses HTTP `no-store` while retaining the existing server history cache. A strict read failure returns 503, never an empty successful deletion snapshot. Cache generations prevent reads begun before a correction from restoring stale cached data. `tests/history-corrections.cjs`, `tests/history-data.cjs`, and `tests/realtime-rates.cjs` cover correction persistence, historical publishing guards, deletion and in-flight races.

- Publishing readiness contract (2026-10-12): authenticated `POST /api/internal/notify-rates-updated?wait=true` responds only after the shared database synchronization, USD/EUR HTML cache rebuild when prices change, and Socket.IO broadcast. Success is `{status:"synchronized",lastUpdated,parallel:{USD,EUR},official:{USD,EUR}}`; exhausted database retries return 503. Calls without `wait=true` retain the legacy immediate `accepted` response, which is not publishing readiness. Only this waiting path gets a 20-second HTTP timeout; ordinary APIs retain their existing limits. Do not accept client-provided prices as database truth.

- `server/socket/socket.service.ts` emits `rates_update`, sends a snapshot on connection, and suppresses duplicate broadcasts based on official/parallel prices and `lastUpdated`. Preserve the `Rates` shape: `official`, `parallel`, `previousOfficial`, `previousParallel`, `lastUpdated`, and `lastChanged.{official,parallel}` (`server/types.ts`, `src/types/rates.ts`).
- Other events include `online_count` (`{count}`), `config_update` (`{config}`), `app_version` (`{version,serverStartTime}`), and admin-room `user_logs` (`{logs}`). Inspect consumers in `src/Admin.tsx` as well as the public hook before changing them.
- `src/hooks/useRatesData.ts` decodes/validates updates, rejects older snapshots, updates React state and local `lyd_rates`/`lyd_history` storage, and appends live history. It protects newer socket data from stale HTTP responses. `src/App.tsx` consumes this state for the UI.
- Socket.IO uses polling/WebSocket transports and automatic reconnection; the hook fetches a snapshot after reconnection. Unmount removes listeners, disconnects the socket and clears its interval. The hook's 30-second fallback poll is for visitor count, **not price collection**.
- Server DB caches are 30 seconds for rates and 60 seconds for history. `/api/rates?refresh=true` forces a DB read, not an external-source fetch. HTTP rates cache is `max-age=15, stale-while-revalidate=30`; history uses `no-store` so historical corrections are not masked by browser HTTP caches. The hook requests with `cache: 'no-store'`.
- The notification loader `loadLatestRatesFromSupabase()` reads the latest parallel/official rows directly and then broadcasts in-memory rates; it is not the full history initialization path. Check every cache layer and timestamp when diagnosing freshness, including PWA behavior, rather than assuming notification acknowledgement invalidates everything.

### Administration and Telegram contracts

- Owner-approved account recovery (2026-10-12): personal Telegram/WhatsApp connections belong exclusively to Worker. Web `TelegramManager.getClient()` must never open a personal MTProto socket, even when shared legacy settings/environment contain a session. Web's legacy OTP routes respond 409 and direct administrators to Worker. Preserve Bot API contact delivery and critical alerts; Web weekly-harvest images now use `sendPhoto` with the configured bot/admin recipient instead of the Worker account. A configured bot must have target-channel posting access.
- Worker saves new Telegram credentials privately in existing `server_config.worker_telegram_auth`, not shared `app_config`. Its account lease coordinates rolling Worker instances; do not copy the new auth key into Web or another service. The owner confirmed the old session was shared and Telegram returned `AUTH_KEY_DUPLICATED`, so recovery requires one fresh Worker login after Web's personal connection path is disabled. Existing WhatsApp `{}` checkpoints still mean explicit logout, not credentials to restore.

- Public header's More menu links to `/admin`; logo clicks only return to the public dashboard. `/admin/` and legacy `/admin-panel-secure` routes also work. The old device-setup URL only redirects to login, never grants client-side authorization. Entry links/bookmarks are navigation, not authentication; HTTP and Socket.IO must validate the server token.
- Admin Socket.IO clients supply `auth.token`. The server validates the existing 24-hour HTTP admin token before joining the private room and removes expired members before private broadcasts. Client `role`/`isAdmin` flags are not authorization.
- `config_update` sends only `{config:{terms}}` to public sockets; the validated admin room receives full config. Obfuscation is not access control.
- The owner confirms `app_config.config.terms` is the extraction-settings source shared with Worker. Loading settings must preserve configured regex, min/max, names, inverse flags and deletions instead of silently substituting defaults. Worker refreshes these terms on source activity with a shared five-minute read cooldown. Paired Worker regression tests cover both configuration loaders and Web save round-trips.
- Web owns visitor contact delivery and Web critical-error alerts. These bot features are separate from Worker price-source Telegram clients and scheduled publishing. Preserve existing configured destinations and delivery fallbacks.
- Bot settings/status and manual delivery tests live in `AdminTelegramBot`; social publishing and legacy account linking remain in `AdminTelegram`. Routes are `/api/admin/telegram/bot-status`, `/test-contact`, and `/test-error-alert`. Recipient suggestions require explicit `?detectChatId=true` and administrator confirmation; runtime sending must never select the last visitor who messaged the bot.
- Alert delivery uses configured chat IDs, redacts bot tokens, suppresses identical successful alerts for 15 minutes, and allows retry after failed delivery. Transient visitor/network errors are ignored; repeated client render failures and significant Web/server/security failures are eligible. A fully stopped service needs external monitoring, not an in-process alert.
- Web stats/report do not prove Worker health. Worker runtime metrics are unknown here; last known price time comes from Web's in-memory rates. Expensive database counts share a 60-second cache, separate from price caches.
- Web `/api/admin/cbl-status` and `/cbl-toggle` currently use legacy Web-local scraper state, not a live Worker status/control proxy. Do not treat these responses as proof of Worker's current CBL status. Worker now enforces a strict 09:00-11:00 Tripoli window and one successful daily save, including manual job requests; no CBL source fetch occurs on Worker startup.
- Never hardcode bot tokens in browser source. Removing an exposed token from current code does not revoke it or erase repository history; the owner must rotate previously exposed credentials.

### Local verification

- Web Push price summaries originate in the deduplicated Web Socket.IO broadcaster, not per-currency social publishing. Settings must save a real Push subscription, not just browser permission. Admin Push routes require the existing admin token; device tests target only the supplied validated subscription. Never send live production campaigns during verification.
- Notification policy: batch important price changes for three minutes, at most three automatic summaries per Tripoli day with a two-hour interval, silent, and no automatic price sending from 22:00 to 08:00. In-page price digests have a five-minute interval; live prices are not delayed. Manual admin announcements retain their separate three-per-day/ten-minute limits and device tests.
- The invitation offers direct activation only on a user tap. Permission cannot be forced; respect denial, explicit opt-out and the existing 30-day dismissal. Hide the invitation only after successful subscription persistence, not permission alone. Shared notification constants supply both settings and admin policy text.

- `npm run lint` checks TypeScript under `src` only; it does not validate server runtime references.
- `node tests/admin-regression.cjs` checks alerts, private bot delivery, Web stats/report and actual local Socket.IO authorization/live broadcasts with mocked database and HTTP services.
- `node tests/admin-ui.cjs` uses an isolated Vite/Socket.IO fixture and mocked admin APIs for responsive layout, navigation, bot checks, drafts and inbox behavior. Set `PLAYWRIGHT_MODULE` and `UI_BROWSER_CHANNEL` if the browser runtime is not installed locally. No production Telegram messages or database writes are performed.
- `node tests/realtime-rates.cjs` covers public live-price behavior; `npm run build` compiles the public/admin UI and server bundle.
- Chart history must load independently of stale HTTP price snapshots: preserve live Socket.IO prices while merging valid historical rows, deduplicated by timestamp. `node tests/history-data.cjs` verifies forward-only historical carry, invalid-date handling and cache invalidation; never fill older gaps with current prices. Realtime tests also render main/analysis/detail charts on desktop and mobile.
- `node tests/push-notifications.cjs` isolates Push delivery, SQLite, remote subscriptions and service-worker/browser APIs. It checks grouping, limits, validation, cleanup, authorization and failures without production access; physical-device notification delivery still needs verification after deployment.
- After a build, `node tests/push-registration.cjs` checks real compiled service-worker activation, unified scope, PushManager and notification assets in an isolated browser. It does not request permission or subscribe a real device.

## Required working rules

### Monthly history retention (2026-10-19)

- Worker and explicit Web cleanup preserve all observations from Tripoli midnight 30 days ago through today, plus the last pre-window row per price table. They no longer downsample the retained month. The last/only available quote is never pruned; shared cleanup failures are reported, not silently accepted. Manual Web price saves no longer trigger independent history deletion.
- Web history reads the complete retained window in ordered 500-row pages, with a ten-second shared deadline and 10,000-row cap per table. Exceeding the cap or a failed page returns an error, never a successful truncated month. Concurrent reads coalesce; the existing 60-second cache and generation protection remain. History/explicit cleanup HTTP routes have a 15-second timeout; other API limits remain unchanged.
- `/api/history` and correction `history_update` include the full loaded window instead of the last 120 points. Optional `HistoryPoint.observed.{parallel,official}` lists actual observations at each timestamp so carried-forward currencies do not bias chart means. Live snapshots with known previous prices mark only changed markets; unchanged-source observations are restored by authoritative history reads rather than guessed from a global snapshot time. Older clients/points remain compatible. Client cached history is bounded by the retained calendar window.
- Advanced monthly charts show daily arithmetic observation means in Africa/Tripoli; high/low, latest/close and change remain based on real observations. Daily display grouping is not a database rewrite and does not fabricate missing days. The official market still uses its last quote per day, including four-decimal precision.
- `tests/history-data.cjs`, `tests/history-corrections.cjs`, `tests/developer-api.cjs` and `tests/realtime-rates.cjs` cover pagination, full-month HTTP/socket history, daily means, raw extrema, correction rebuilds and desktop/mobile charts. Paired Worker regression/integration tests also exercise Web's real cleanup policy/routes. Previously deleted data and deployed database health are not established by these isolated tests.

### Cash/check spread analysis (2026-10-20)

- Public Analysis has separate Prices and Cash/Checks tabs. `cashChecksSpread.ts` computes `(USD_CHECKS - USD)` in LYD/USD and the percentage relative to cash, never relative to checks. Only finite positive prices from the same history timestamp, explicitly marked with both parallel observations, qualify. Legacy/carried/official-only rows and bank-specific aliases do not establish a pair. Do not reinterpret `lastChanged` as a quote observation time.
- The UI uses the latest shared stored snapshot, not an invented combination of current quotes. A newer mismatched rate pair displays a pending notice; a snapshot older than 12 hours or offline data is labeled. Snapshot time is not proof of synchronized source trades. All descriptions are deterministic calculations, not investment advice or AI requests.
- The spread comparison opens with both price series; its amount tool uses that same shared pair, preserves typed amounts on live/history updates, and multiplies raw prices before formatting. Empty/invalid amounts are not zero. Amounts are limited to 0-1,000,000,000 USD with finite, precision-bounded results. Period summaries distinguish the individual price movements from widening/narrowing of their gap; detailed statistics remain collapsed initially. No extra requests or subscriptions are added.
- Today uses hourly bins; 7/30-day views use Tripoli calendar days. Missing bins remain null and are not connected. Means are calculated per snapshot; the period's daily mean weights each observed day equally. Raw high/low and first/last changes are preserved. The previous-day reference uses median and 25th/75th percentiles only after seven observed days, excluding the latest snapshot's calendar day. This is a descriptive historical range, not a forecast/confidence interval.
- The feature runs solely in Web's existing React state, with no new API, database request, Worker task or subscription. The local minute clock only updates freshness, stops while hidden, and is cleaned up when the panel unmounts. Preserve light/dark, large text and keyboard tab behavior.
- Public/visitor charts use Recharts `monotoneX` for bounded visual interpolation, rounded strokes and `market-charts.css`; no source data is smoothed or resampled for styling. Official daily detail charts use `stepAfter`, retain four-decimal prices and date-only labels. Null spread bins remain disconnected, with markers for sparse observations. Shared price tooltips use Tripoli time and preserve each view's daily-mean versus raw-observation labels. `tests/chart-presentation.cjs` checks bounded curve controls and tooltip validity; browser fixtures verify actual paths, anchor counts, touch/keyboard access and responsive themes.
- `node tests/cash-checks-spread.cjs` verifies the math, data admission, midnight, gaps, weighting, corrections, precision and honest unavailable states. `node tests/cash-checks-spread-ui.cjs` verifies isolated responsive UI without production access; `--preview` serves labeled sample data on loopback. `tests/realtime-rates.cjs` also exercises real Socket.IO/correction updates in the full App without extra price requests.

### Visitor analytics

- The admin connection snapshot is separate from pageview analytics: at most 200 in-memory device records, periodic 24-hour cleanup, lost on server restart. Reconnect counts are not visits. Show device/location/status first; expand browser, IP, model and timestamps on demand without another API call.
- Socket visitor details respect enableUserTracking, DNT/GPC and auth.tracking=false; authenticated admin connections are excluded. Distinct validated device IDs must not be merged just because they share an IP/User-Agent. Forwarded IP selection follows the Web single-proxy-hop setting (rightmost X-Forwarded-For); review both together if hosting changes.
- Device parsing reuses installed UAParser. Android Client Hints request only model, once per mounted client, on a server request; all device reports are unverified browser claims. Reduced Android User-Agents must not be presented as a known model/OS version. Location uses HTTPS ipwho.is, never GPS: bounded cache (1,000 entries), 24-hour successful/15-minute failed TTL, two concurrent lookups, 20/minute and 900/24-hour per-process caps, and provider 429 backoff. Private/reserved IPs and detected bots skip external lookup. No shared schema changes.
- node tests/visitor-details.cjs covers isolated device/location and real Socket.IO privacy/identity checks; analytics-ui.cjs covers responsive compact records and expandable details. Its --preview mode serves clearly labeled sample data on loopback only. realtime-rates.cjs checks model reporting/reconnects/GPC alongside price updates. None verifies physical device identity or production geographic accuracy.

- Public page views are recorded by `useVisitorAnalytics`, not price updates or Socket reconnects. DNT/GPC disable page analytics; `enableUserTracking` is enforced server-side. Only known public page paths are accepted; referrers retain origin only. Never store query-string secrets or derive pageviews from connection counts.
- `/api/analytics/track` has per-IP and process-wide request limits, 30-second duplicate suppression, bounded concurrent writes and a remote-write timeout. Local-only writes are counted visibly in the admin report; there is no durable remote retry queue. Do not claim lossless analytics or that a unique browser ID equals a person.
- Admin `/analytics` accepts 1/7/30 calendar-day ranges in Africa/Tripoli, caches aggregates for five minutes, coalesces concurrent reads, and caps each raw report at 10,000 events. Local fallback and truncation disable growth comparisons. No automatic analytics polling or shared schema changes were introduced.
- `node tests/analytics.cjs` and `node tests/analytics-ui.cjs` cover isolated aggregation, collection, privacy, caching and responsive admin behavior. They do not measure production completeness or Render CPU/RAM.

- Preserve public UI/PWA, Socket.IO, admin UI, authentication, and visitor functionality.
- Treat the Worker as owner of background source fetching, publishing, and scheduled jobs; Web may call authenticated Worker APIs server-side.
- Do not move Worker jobs into Web or add duplicate scraping, scheduling or intensive polling without an explicit request. Keep Render CPU, memory, database and network usage low.
- First locate a fault in Web, Worker, Supabase or the connection between services. Do not compensate for an unverified Worker fault with arbitrary Web changes.
- Inspect actual callers, routes, authentication, response shapes and Socket.IO subscribers on both sides before altering integration contracts. Preserve automatic reconnection, subscriptions/cleanup and live prices without full-page reloads.
- Never expose Supabase service-role keys, Worker secrets, or full internal config to the browser.
- Keep secrets in ignored local environment files or service environment settings, never in documentation, commits, browser bundles or diagnostic output.
- Cron authentication accepts only the configured `CRON_SECRET` environment value; never restore the embedded legacy fallback removed during the 2026-10-12 secret scan. It was already present in repository history, so deletion alone does not revoke it. The owner must rotate any matching deployed secret and update the authorized scheduler/callers, without committing the replacement.
- Verify admin Socket.IO authorization server-side.
- Do not modify Worker files or shared Supabase schema without explicit approval.
- Analyze the impact on both projects before changing shared tables, columns, timestamps or price representations. Preserve the independent Worker dashboard and existing authenticated integrations.
- If Worker files are unavailable, describe the required Worker-side check/change and its uncertainty; do not invent an implementation or claim end-to-end verification.
- Before changes, trace API and notification contracts and test public price freshness after deployment.
- Separate owner-provided architecture, code-confirmed behavior and live-service evidence in reports. A static code inspection is not a production health test. Do not start a backend against production credentials just to inspect the architecture.
- Skills available when installed: `$dollar-rates-diagnostics`, `$safe-project-refactor`, `$render-resource-optimizer`.

## Paired Review Update (2026-10-11)

The locally available Worker implementation has now been inspected and tested with isolated fixtures; this does not verify its deployed Render service. Read its own instructions for the current queue, source-processing and WhatsApp session behavior.

- Worker owns successful source persistence and the sole social-price queue. Web remains the only visitor Push sender. Keep the two checkouts, credentials, deployments and Git operations independent.
- Both servers now start without sample prices/synthetic history. An unavailable database must not become a fabricated quote.
- Web's notification snapshot loader preserves previous prices, consumes parallel `last_changed`, rejects older market snapshots, coalesces in-flight reads and invalidates history/rates caches. It must never replace a successful synchronization with a full-page reload.
- The authenticated notification route still acknowledges immediately. It now retries failed database synchronization at most three times with 2/4-second delays and coalesces concurrent notifications, retaining a follow-up read if another notification arrives during synchronization. This is event-triggered recovery, not periodic price polling.
- Admin WhatsApp `POST /api/admin/whatsapp/toggle-auto` proxies a strictly boolean `enabled` to the authenticated Worker route. The existing parent admin-token middleware must remain.
- Web must not unpack Worker WhatsApp session files onto its filesystem. Worker session/queue keys live in existing `server_config`; their actual Supabase permissions are not established by a local test.
- Both services still save full shared `app_config` rows. Do not promise concurrent multi-service settings writes are atomic without a verified database-side contract.
- Unused Firebase was removed after checking for callers; visitor Push continues through the existing Web Push implementation. Both npm audits reported zero known advisories on 2026-10-11. This does not verify live configuration, RLS or account security.

## Database Access Rollout (2026-10-12)

- Read-only production checks confirmed anonymous exposure of private app_config credentials, contact messages, Push subscription keys and logs. Never reopen anonymous permissions to restore an admin workflow. Deploy server-only database credentials before applying Worker's supabase_security_hardening.sql; see its DATABASE_ROLLOUT.md. Prepared SQL is not proof that production permissions have changed.
- Server credentials stay out of the browser bundle. Set SUPABASE_SERVICE_ROLE_KEY in Render Web before deployment; keep the separate anon settings configured. Rotation of exposed credentials requires coordination and provider revocation, not only removal from source.
- Error-log deletion uses a non-null primary-key filter compatible with integer IDs. Local broadcast timestamps stay milliseconds; remote broadcast_log uses timestamptz with ISO insertion and retention filters.
- node tests/database-access.cjs isolates database credentials and the actual log-deletion route. Supply WORKER_PROJECT_PATH to test both services' remote broadcast timestamp contracts. No production environment loading or writes occur.

## Developer API (2026-10-14)

- The free `GET /api/public/rates` returns only parallel cash USD/EUR in LYD. It serves the Web memory snapshot without database/source requests and uses `Cache-Control: no-store`. Its `lastUpdated` comes from the parallel row, not a newer official/global timestamp. Missing/invalid/future data returns 503; a parallel snapshot older than 12 hours returns 503 with `success:false, stale:true` and the last available values.
- API quotas use the trusted Express IP and IPv6 subnet grouping. Runtime settings are `app_config.config.apiConfig.{enabled,rateLimitWindowMs,rateLimitMaxRequests}`; validate bounds before applying. Defaults and the maximum quota are 5 requests/minute/IP; longer windows can further restrict access. Existing higher settings fall back to the conservative default. Documentation recommends one request per five minutes and uses https://dollar-price-qp14.onrender.com/api/public/rates. Paid access is requested through Contact, with agreed quotas. Changing the window recreates one store and clears its timer; changing only the maximum preserves counts. Public quota exhaustion returns 429/Retry-After without banning website visitors. A per-process 120-request/minute capacity ceiling, 10,000 tracked-IP cap and 100-entry request log bound resource usage. These are application limits, not distributed DDoS protection.
- `/api/admin/api-stats` and `/api-config` retain admin-token authentication. Report remote persistence failure honestly. Never expose a premium key in responses or URL query strings. `/api/premium/rates` requires the server-only `PREMIUM_API_KEY`, has no built-in fallback, and uses private/no-store responses.
- `Developers` is the canonical public guide; `ApiDocs` re-exports it. Examples and admin links must match the real routes. No unverified uptime guarantees. The guide's request test is manual and bounded, not polling.
- `node tests/developer-api.cjs` checks real routers/limiters with isolated state; `node tests/developer-api-ui.cjs` tests the public/admin components on light/dark mobile/desktop fixtures. Neither contacts production. Paired Worker test fixtures include the new Web headers/shared constants; Worker runtime behavior is unchanged.

## Social Link Previews

- Web HTML preview cache tracks both parallel USD and EUR. Missing prices are omitted, never shown as zero. ETags hash rendered HTML rather than a truncated USD-only timestamp.
- Numeric r query parameters (6-32 digits) are preserved in og:url/twitter:url for distinct Telegram shares without per-URL cache growth or database reads. Other query values are not reflected into metadata. Facebook retains its root/short URL and current logo asset.
- Both social senders replace the website short URL with a WEB_SERVER_URL-based, numeric cache-busting link only for Telegram. Immediate retries reuse the same link; Facebook keeps tinyurl.com/2j7667u2. Worker tests/social-previews.cjs with WEB_PROJECT_PATH checks both senders and the real production HTML handler. External platform caching and existing posts cannot be guaranteed by these fixtures.
