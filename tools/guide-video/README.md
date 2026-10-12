# Converter Guide Video

Local-only Remotion production for the public app guide. No backend, environment
files, production prices, credentials or Worker jobs are loaded. Training values
are visibly labelled, and the capture uses the real converter component and hook.

From this folder, run `npm ci`, then `npm run render`. Install Playwright locally
or set `PLAYWRIGHT_MODULE` to its existing module path. Optional
`UI_BROWSER_CHANNEL=msedge` selects Edge for capture;
`REMOTION_BROWSER_EXECUTABLE` selects the Chromium executable for Remotion.

Generated MP4/JPEG files go to `public/guide`. Regenerate after converter layout
changes. Keep all Remotion packages pinned to the same version. These dependencies
are deliberately separate from the root installation and Render build. The public
application plays finished H.264 videos with native browser controls; it never
renders Remotion compositions. Both responsive variants last 20 seconds, have no
audio and share Arabic captions and a written alternative in the guide.

The mobile composition pans between real fields without shrinking the entire
screen. Capture has its own ignored Vite cache; the Web optimizer scans only
`index.html` and deduplicates React so tooling cannot pollute the app runtime.
