# Dollar Price UI

## Scope and priorities

1. Preserve price hierarchy, source distinctions, real timestamps, RTL, and the existing emerald identity.
2. Unify contrast, surfaces, Arabic typography, focus, and light/dark presentation.
3. Keep mobile controls reachable and dialogs contained; reduce decoration and oversized type.
4. Apply the same presentation system to public pages and Web administration.

No dependencies were added. Data hooks, storage helpers, backend services, routes, authentication,
notifications, Worker, PWA configuration, and service-worker source are unchanged.

## Presentation tokens

src/styles/design-system.css supplies neutral primitives, semantic foreground/surface/status
colors, and an 8px control radius. Existing presentation utilities are bridged to these tokens
inside .app-shell and .admin-shell, rather than rewriting component behavior.
Cairo remains the primary Arabic face; monospaced/tabular digits support price comparison.
Emerald indicates upward movement, rose downward movement, blue official rates, and gold metals.
Existing icons, flags, price hierarchy, market grouping, and callbacks remain in place.

ThemeToggle changes only the document's data-theme. Theme selection lasts for the current
document and is not persisted, intentionally avoiding changes to existing storage contracts.
Printing and the weekly image-export canvas are excluded from theme utility overrides.

## Changed surfaces

The primary price overview uses equal two-column cards on mobile and desktop. On desktop,
the four-card grid and USD chart share equal-width columns and stretch to the same height.
Other currencies occupy a full-width section below the overview. Rate cards separate the
currency name, price, movement badge, and previous/update rows. Mobile navigation is a
floating bottom bar with 12px side insets and safe-area spacing; search, refresh, and more stay visible at all widths.

Header tools share 44px targets with native title tooltips, a keyboard-accessible home link,
and a bounded scrolling overflow panel. The header integrates section navigation on desktop
and a second navigation row on tablets. Mobile keeps one row; below 480px, theme
control moves into the more panel alongside synchronization time, guide, and installation.
Search has a distinct accent surface and a visible label from tablet size. Mobile tabs highlight the entire
selected item with a muted emerald surface and border, without moving the icon or label.
Currency flags use rectangular frames and contain the complete flag without cropping or distortion;
failed images use accessible fallback icons.

- index.html, src/index.css, src/styles/design-system.css: zoom, typography, tokens,
  focus, reduced motion, scrollbars, spacing, contrast, and responsive rules.
- src/App.tsx, src/Admin.tsx: presentation roots, simpler backgrounds, mobile navigation
  return behavior, accessible administration menu, and reduced-motion configuration.
- src/Contact.tsx, src/Developers.tsx, src/components/{About,Privacy,Terms,ApiDocs}.tsx:
  consistent reading scale, form labels, error announcements, and URL wrapping.
- src/components/{Header,MobileNav,RateCell,CurrencyConverterSection}.tsx:
  theme control, adaptive narrow-screen actions, navigation, touch areas, price cards,
  and calmer converter input presentation.
- src/components/rates/MainRatesGrid.tsx, src/components/charts/AdvancedChartsSection.tsx:
  four primary currency cards, a two-column mobile rate view, desktop chart/rates dashboard
  grid, additional market columns, real-data charts, clearer time axes, and responsive filters.
- src/components/rates/GoldMetalsSection.tsx: explicit empty state and no unconditional live-price claim.
- src/components/modals/{CurrencyChartModal,SearchModal,SettingsModal}.tsx:
  focus, escape handling, dialog semantics, readable controls, truthful history presentation.
- src/hooks/useDialogAccessibility.ts: shared focus containment and restoration.
- src/components/ui/{ThemeToggle,RateSkeleton,OfflineBanner,AppToasts,FloatingSocialButtons}.tsx:
  themes, stable loading geometry, status announcements, and overlay ordering.
- tests/ui-smoke.cjs: isolated browser fixtures and layout/interaction checks.

## Verification

- npm run lint: TypeScript.
- npm run build: Web, server bundle, and PWA compilation.
- tests/ui-smoke.cjs: Edge through Playwright; viewports 320x740, 375x820, 430x932,
  768x1024, 1024x900, 1440x1000, and 1920x1080. Checks themes without changing prices/storage, overflow, navigation,
  loading, converter field separation, legal pages, search, keyboard dialogs, settings, clipboard success/failure, contact success/failure,
  price refresh, failed price requests, empty history, administration login/menu/dashboard.
- Existing tests/cbl-service.test.ts: run with external service imports isolated and network
  disabled to avoid database initialization. 17 assertions passed. This is not a live-service test.

Browser checks use intercepted API responses, blocked Socket.IO and service workers, and
throwaway browser storage. They do not prove live Supabase, Worker, Socket.IO, authentication,
push delivery, or destructive administration actions. Do not run those actions against production
as visual tests. Initial JavaScript remains about 1.35 MB before gzip; dependency splitting was
not included in this presentation-only change.

Additional read-only live preview checks at 375px and 1440px verify the primary cards and
overflow with actual public API data. The Vite-only preview reads public endpoints and
Socket.IO through the APP_URL development proxy; server-side scheduling is not started.

The local preview is http://127.0.0.1:5175/. Keep generated dev-dist while Vite is running:
deleting it causes the PWA development registration script to return ENOENT.
