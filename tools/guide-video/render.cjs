const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { selectComposition, renderMedia, renderStill, getVideoMetadata } = require('@remotion/renderer');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const { createServer } = await import('vite');
  const { default: react } = await import('@vitejs/plugin-react');
  const { default: tailwind } = await import('@tailwindcss/vite');
  const root = path.resolve(__dirname, '../..');
  const captureDir = path.join(__dirname, 'captures');
  const output = path.join(root, 'public/guide');
  fs.mkdirSync(captureDir, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  // No project config/env/backend is loaded by this isolated capture server.
  const vite = await createServer({ configFile: false, root, cacheDir: path.join(captureDir, '.vite'), optimizeDeps: { entries: ['tools/guide-video/capture.html'] }, plugins: [react(), tailwind()], resolve: { dedupe: ['react', 'react-dom'] }, server: { host: '127.0.0.1', port: 0 } });
  await vite.listen();
  let browser;
  const manifest = {};
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.UI_BROWSER_CHANNEL });
    for (const [variant, width, height] of [['mobile', 360, 736], ['desktop', 640, 560]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      manifest[variant] = [];
      for (let step = 0; step < 4; step++) {
        await page.goto(`http://127.0.0.1:${vite.httpServer.address().port}/tools/guide-video/capture.html?step=${step}`);
        await page.locator('#converter-currency').waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.fonts.check('700 16px Cairo')), 'Cairo font must load before capturing');
        if (step === 0) await page.selectOption('#converter-currency', 'USD');
        if (step === 1) await page.locator('#converter-foreign').fill('100');
        if (step === 3) {
          await page.getByRole('button', { name: 'إدخال القيمة بالدينار' }).click();
          await page.locator('#converter-parallel').fill('500');
          assert.equal(await page.locator('#converter-foreign').inputValue(), '50');
        }
        await page.locator('#converter-currency').blur();
        await page.locator('input:focus').evaluateAll(inputs => inputs.forEach(input => input.blur()));
        const target = page.locator(['#converter-currency', '#converter-foreign', '.converter-result-fields', '#converter-parallel'][step]);
        const box = await target.boundingBox();
        manifest[variant].push(Object.fromEntries(Object.entries(box).map(([key, value]) => [key, value * 2])));
        assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth), `${variant} capture must fit`);
        await page.screenshot({ path: path.join(captureDir, `${variant}-${step}.png`) });
        if (variant === 'mobile') await page.locator('.capture-frame footer').screenshot({ path: path.join(captureDir, `mobile-caption-${step}.png`) });
      }
      await page.close();
    }
    fs.writeFileSync(path.join(captureDir, 'manifest.json'), JSON.stringify(manifest));
  } finally {
    if (browser) await browser.close();
    await vite.close();
  }
  const { bundle } = require('@remotion/bundler');
  const serveUrl = await bundle({ entryPoint: path.join(__dirname, 'composition.tsx'), publicDir: captureDir });
  for (const variant of ['mobile', 'desktop']) {
    const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
    const composition = await selectComposition({ serveUrl, id: variant === 'mobile' ? 'ConverterMobile' : 'ConverterDesktop', browserExecutable });
    let lastProgress = -1;
    await renderMedia({ serveUrl, composition, browserExecutable, codec: 'h264', pixelFormat: 'yuv420p', crf: 23, concurrency: 2, outputLocation: path.join(output, `converter-${variant}.mp4`), onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 10) * 10;
      if (percent !== lastProgress) { lastProgress = percent; console.log(`${variant}: ${percent}%`); }
    } });
    await renderStill({ serveUrl, composition, browserExecutable, frame: 375, output: path.join(output, `converter-${variant}.jpg`), imageFormat: 'jpeg' });
    const metadata = await getVideoMetadata(path.join(output, `converter-${variant}.mp4`));
    assert.equal(metadata.width, composition.width);
    assert.equal(metadata.height, composition.height);
    assert(Math.abs(metadata.durationInSeconds - 20) < 0.1, 'Lesson must be 20 seconds');
    console.log(`${variant}: verified ${metadata.width}x${metadata.height}, ${metadata.durationInSeconds}s`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
