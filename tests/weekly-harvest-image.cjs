const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { build } = require('esbuild');
const sharp = require('sharp');
const fs = require('node:fs/promises');
const os = require('node:os');

async function main() {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: "export * from './server/services/weekly-harvest-image.service'; export * from './shared/weeklyHarvest';" },
    bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external' });
  const mod = new Module(path.join(process.cwd(), 'tests/weekly-image-isolated.cjs'), module); mod.paths = module.paths;
  mod._compile(bundle.outputFiles[0].text, mod.id);
  const rows = Array.from({ length: 7 }, (_, i) => ({ recorded_at: `2026-10-${10 + i}T10:00:00Z`,
    rates: { USD: 10.24 - i * .02, USD_CHECKS: 10.54 - i * .05, EUR: 11.20 - i * .01, GBP: 12.6, TND: 3.3 + i * .002, EGP: .2045,
      USD_TR: 10.1, USD_AE: 10.2, USD_CN: 10.3, GOLD_SCRAP_18: 810 + i, GOLD_SCRAP_21: 910 + i, GOLD_CAST_24: 1010 + i, GOLD_LIRA_8G: 7010 + i, SILVER_CAST_1000: 12.5 } }));
  const data = mod.exports.buildWeeklyHarvest(rows, [], [], new Date('2026-10-17T12:00:00Z'));
  const image = await mod.exports.renderWeeklyHarvestImage(data);
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'png'); assert.equal(metadata.width, 1800);
  assert(metadata.height > 2000 && metadata.width + metadata.height < 10000);
  assert(image.length < 5 * 1024 * 1024, 'Image stays within both senders\' upload budgets');
  const ink = await sharp(image).extract({ left: 65, top: 970, width: 1660, height: 600 }).stats();
  assert(ink.channels[0].stdev > 20, 'The table must contain real text pixels');
  const out = path.join(os.tmpdir(), 'Dollar-weekly-harvest'); await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'server-report.png'), image);
  await sharp(image).resize({ width: 450 }).toFile(path.join(out, 'server-report-phone.png'));
  const preview = await mod.exports.renderWeeklyHarvestPreview(image);
  const previewMeta = await sharp(preview).metadata();
  assert.equal(previewMeta.width, 1200); assert.equal(previewMeta.height, 630);
  await fs.writeFile(path.join(out, 'server-report-og.png'), preview);
  const sparse = mod.exports.buildWeeklyHarvest([rows[0]], [], [], new Date('2026-10-17T12:00:00Z'));
  assert((await mod.exports.renderWeeklyHarvestImage(sparse)).length > 10000);
  console.log(`PASS: full Arabic report PNG ${metadata.width}x${metadata.height} (${image.length} bytes), table pixels and sparse data. Preview: ${out}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
