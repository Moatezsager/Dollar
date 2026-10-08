# Dollar Price — Web repository instructions

This repository is the public Web application. It is independently deployed from `worker_server-main` and shares Supabase with it.

- Preserve public UI/PWA, Socket.IO, admin UI, authentication, and visitor functionality.
- Treat the Worker as owner of background source fetching, publishing, and scheduled jobs; Web may call authenticated Worker APIs server-side.
- Never expose Supabase service-role keys, Worker secrets, or full internal config to the browser.
- Verify admin Socket.IO authorization server-side.
- Do not modify Worker files or shared Supabase schema without explicit approval.
- Before changes, trace API and notification contracts and test public price freshness after deployment.
- Skills available when installed: `$dollar-rates-diagnostics`, `$safe-project-refactor`, `$render-resource-optimizer`.
