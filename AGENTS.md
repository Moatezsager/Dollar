# Dollar Price — Web repository instructions

This repository is the public Web application. It is independently deployed from `worker_server-main` and shares Supabase with it.

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
- `server/db.ts` creates the server Supabase client from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; it also maintains local SQLite storage. Inspect the actual credential role/permissions instead of inferring them from the variable name. Never place privileged secrets in `VITE_*` variables.
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

### Realtime and cache behavior

- `server/socket/socket.service.ts` emits `rates_update`, sends a snapshot on connection, and suppresses duplicate broadcasts based on official/parallel prices and `lastUpdated`. Preserve the `Rates` shape: `official`, `parallel`, `previousOfficial`, `previousParallel`, `lastUpdated`, and `lastChanged.{official,parallel}` (`server/types.ts`, `src/types/rates.ts`).
- Other events include `online_count` (`{count}`), `config_update` (`{config}`), `app_version` (`{version,serverStartTime}`), and admin-room `user_logs` (`{logs}`). Inspect consumers in `src/Admin.tsx` as well as the public hook before changing them.
- `src/hooks/useRatesData.ts` decodes/validates updates, rejects older snapshots, updates React state and local `lyd_rates`/`lyd_history` storage, and appends live history. It protects newer socket data from stale HTTP responses. `src/App.tsx` consumes this state for the UI.
- Socket.IO uses polling/WebSocket transports and automatic reconnection; the hook fetches a snapshot after reconnection. Unmount removes listeners, disconnects the socket and clears its interval. The hook's 30-second fallback poll is for visitor count, **not price collection**.
- Server DB caches are 30 seconds for rates and 60 seconds for history. `/api/rates?refresh=true` forces a DB read, not an external-source fetch. HTTP rates cache is `max-age=15, stale-while-revalidate=30`; history is `max-age=120, stale-while-revalidate=300`. The hook requests with `cache: 'no-store'`.
- The notification loader `loadLatestRatesFromSupabase()` reads the latest parallel/official rows directly and then broadcasts in-memory rates; it is not the full history initialization path. Check every cache layer and timestamp when diagnosing freshness, including PWA behavior, rather than assuming notification acknowledgement invalidates everything.

### Administration and Telegram contracts

- Public header's More menu links to `/admin`; logo clicks only return to the public dashboard. `/admin/` and legacy `/admin-panel-secure` routes also work. The old device-setup URL only redirects to login, never grants client-side authorization. Entry links/bookmarks are navigation, not authentication; HTTP and Socket.IO must validate the server token.
- Admin Socket.IO clients supply `auth.token`. The server validates the existing 24-hour HTTP admin token before joining the private room and removes expired members before private broadcasts. Client `role`/`isAdmin` flags are not authorization.
- `config_update` sends only `{config:{terms}}` to public sockets; the validated admin room receives full config. Obfuscation is not access control.
- Web owns visitor contact delivery and Web critical-error alerts. These bot features are separate from Worker price-source Telegram clients and scheduled publishing. Preserve existing configured destinations and delivery fallbacks.
- Bot settings/status and manual delivery tests live in `AdminTelegramBot`; social publishing and legacy account linking remain in `AdminTelegram`. Routes are `/api/admin/telegram/bot-status`, `/test-contact`, and `/test-error-alert`. Recipient suggestions require explicit `?detectChatId=true` and administrator confirmation; runtime sending must never select the last visitor who messaged the bot.
- Alert delivery uses configured chat IDs, redacts bot tokens, suppresses identical successful alerts for 15 minutes, and allows retry after failed delivery. Transient visitor/network errors are ignored; repeated client render failures and significant Web/server/security failures are eligible. A fully stopped service needs external monitoring, not an in-process alert.
- Web stats/report do not prove Worker health. Worker runtime metrics are unknown here; last known price time comes from Web's in-memory rates. Expensive database counts share a 60-second cache, separate from price caches.
- Never hardcode bot tokens in browser source. Removing an exposed token from current code does not revoke it or erase repository history; the owner must rotate previously exposed credentials.

### Local verification

- Web Push price summaries originate in the deduplicated Web Socket.IO broadcaster, not per-currency social publishing. Settings must save a real Push subscription, not just browser permission. Admin Push routes require the existing admin token; device tests target only the supplied validated subscription. Never send live production campaigns during verification.

- `npm run lint` checks TypeScript under `src` only; it does not validate server runtime references.
- `node tests/admin-regression.cjs` checks alerts, private bot delivery, Web stats/report and actual local Socket.IO authorization/live broadcasts with mocked database and HTTP services.
- `node tests/admin-ui.cjs` uses an isolated Vite/Socket.IO fixture and mocked admin APIs for responsive layout, navigation, bot checks, drafts and inbox behavior. Set `PLAYWRIGHT_MODULE` and `UI_BROWSER_CHANNEL` if the browser runtime is not installed locally. No production Telegram messages or database writes are performed.
- `node tests/realtime-rates.cjs` covers public live-price behavior; `npm run build` compiles the public/admin UI and server bundle.
- `node tests/push-notifications.cjs` isolates Push delivery, SQLite, remote subscriptions and service-worker/browser APIs. It checks grouping, limits, validation, cleanup, authorization and failures without production access; physical-device notification delivery still needs verification after deployment.
- After a build, `node tests/push-registration.cjs` checks real compiled service-worker activation, unified scope, PushManager and notification assets in an isolated browser. It does not request permission or subscribe a real device.

## Required working rules

- Preserve public UI/PWA, Socket.IO, admin UI, authentication, and visitor functionality.
- Treat the Worker as owner of background source fetching, publishing, and scheduled jobs; Web may call authenticated Worker APIs server-side.
- Do not move Worker jobs into Web or add duplicate scraping, scheduling or intensive polling without an explicit request. Keep Render CPU, memory, database and network usage low.
- First locate a fault in Web, Worker, Supabase or the connection between services. Do not compensate for an unverified Worker fault with arbitrary Web changes.
- Inspect actual callers, routes, authentication, response shapes and Socket.IO subscribers on both sides before altering integration contracts. Preserve automatic reconnection, subscriptions/cleanup and live prices without full-page reloads.
- Never expose Supabase service-role keys, Worker secrets, or full internal config to the browser.
- Keep secrets in ignored local environment files or service environment settings, never in documentation, commits, browser bundles or diagnostic output.
- Verify admin Socket.IO authorization server-side.
- Do not modify Worker files or shared Supabase schema without explicit approval.
- Analyze the impact on both projects before changing shared tables, columns, timestamps or price representations. Preserve the independent Worker dashboard and existing authenticated integrations.
- If Worker files are unavailable, describe the required Worker-side check/change and its uncertainty; do not invent an implementation or claim end-to-end verification.
- Before changes, trace API and notification contracts and test public price freshness after deployment.
- Separate owner-provided architecture, code-confirmed behavior and live-service evidence in reports. A static code inspection is not a production health test. Do not start a backend against production credentials just to inspect the architecture.
- Skills available when installed: `$dollar-rates-diagnostics`, `$safe-project-refactor`, `$render-resource-optimizer`.
