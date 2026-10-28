const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('esbuild');

const now = Date.parse('2026-10-20T12:00:00Z');
class Clock extends Date { constructor(value = now) { super(value); } static now() { return now; } }
function load(filename, mocks = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'ts', format: 'cjs', target: 'node20' }).code,
    { module: mod, exports: mod.exports, Date: Clock, Intl, Map, require(name) { if (name in mocks) return mocks[name]; throw Error('Unexpected dependency: ' + name); } });
  return mod.exports;
}
const dates = load('src/utils/rateHistory.ts');
const { buildSpreadModel, compareSpreadAmount, getSpreadHistory, spreadReading, spreadNumber, SPREAD_MAX_AMOUNT } = load('src/utils/cashChecksSpread.ts', { './rateHistory': dates });
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const point = (time, cash, checks, observed = ['USD', 'USD_CHECKS']) => ({
  time: new Date(time).toISOString(), ratesParallel: { USD: cash, USD_CHECKS: checks },
  usdParallel: cash, usdOfficial: 6.4, ratesOfficial: { USD: 6.4 }, observed: { parallel: observed, official: [] },
});
const quotes = (cash, checks) => ({ parallel: { USD: cash, USD_CHECKS: checks }, official: {}, lastUpdated: new Date(now).toISOString() });
const day = 86400000;
let data = Array.from({ length: 29 }, (_, i) => point(now - (29 - i) * day - 3600000, 10, 10.2));
data.push(point(now - 3600000, 10, 10.5));
const before = JSON.stringify(data);
let model = buildSpreadModel(data, quotes(10, 10.5), 30, now);
close(model.latest.gap, .5); close(model.latest.premium, 5); close(model.reference.premium, 2);
assert.equal(model.reference.days, 29); assert.equal(model.position, 'above'); assert.equal(model.observedDays, 30);
assert.equal(model.selected.length, 30); assert.equal(model.bins.length, 30); assert.equal(model.stale, false); assert.equal(model.pending, false);
close(model.change, .3); close(model.meanGap, (.2 * 29 + .5) / 30);
assert.match(spreadReading(model).headline, /أعلى.*0.50 د.ل للدولار/);
assert.match(spreadReading(model).detail, /على 1,000 دولار.*يزيد 500.00 د.ل.*قبل الرسوم/);
assert.match(spreadReading(model).movement, /كبرت بـ 0.30 د.ل.*من 0.20 إلى 0.50/);
assert.match(spreadReading(model).comparison, /أعلى من.*2.00%.*29 يوم رصد/);
assert.match(spreadReading(model).priceMovement, /سعر الكاش لم يتغيّر.*سعر الصكوك زاد 0.30 د.ل/);
assert.equal(JSON.stringify(data), before, 'Analysis cannot mutate shared history, prices or source times');
console.log('PASS: signed difference, cash-denominated percentage, daily reference, equal-day mean, useful Arabic summary and immutable source data');

const invalid = [
  { ...point(now, 10, 11), aggregation: 'daily' },
  { ...point(now, 10, 11), time: 'invalid' }, point(now + 1, 10, 11), point(now, 0, 11), point(now, -10, 11),
  point(now, 10, NaN), point(now, 10, Infinity), point(now, '10', 11), point(now, 1e-308, 1e308),
  point(now, 10, 11, ['USD']), point(now, 10, 11, ['USD_CHECKS']), point(now, 10, 11, []),
  { ...point(now, 10, 11), observed: undefined }, { ...point(now, 10, 11), observed: { parallel: 'USD,USD_CHECKS' } },
  { ...point(now, 10, undefined), ratesParallel: { USD: 10, USD_JBANK: 11, USD_NCB: 11 } },
];
for (const row of invalid) assert.equal(getSpreadHistory([row], now).length, 0, JSON.stringify(row));
const duplicate = [point(now - 1000, 10, 11), point(now - 1000, 10, 10.1)];
close(getSpreadHistory(duplicate, now)[0].gap, .1);
assert.equal(getSpreadHistory([...duplicate, point(now - 1000, 10, NaN)], now).length, 0, 'A later invalid replacement cannot resurrect the earlier duplicate');
console.log('PASS: no carried/legacy/official/bank-alias pairings, malformed/future/invalid data rejected and correction duplicates are authoritative');

const midnight = Date.parse('2026-10-19T22:00:00Z');
model = buildSpreadModel([point(midnight - 1, 10, 10.2), point(midnight, 10, 10.3), point(now - 1000, 10, 10.4)], quotes(10, 10.4), 1, now);
assert.equal(model.selected.length, 2); assert.equal(model.observedDays, 1);
assert.equal(model.bins.filter(bin => bin.count).length, 2); assert(model.bins.some(bin => bin.gap === null));
assert.equal(model.bins[0].time, midnight); assert.equal(model.reference, null);
model = buildSpreadModel(data.filter((_, i) => i !== 15), quotes(10, 10.5), 30, now);
assert.equal(model.bins[15].count, 0); assert.equal(model.bins[15].gap, null); assert.equal(model.observedDays, 29);
const mixed = [...data, point(now - 100, 55, 60, []), point(now - 50, 55, 60, ['GOLD_SCRAP_18'])];
close(buildSpreadModel(mixed, quotes(10, 10.5), 30, now).latest.gap, .5);
console.log('PASS: Tripoli midnight, hourly/daily bins, explicit calendar gaps, and unrelated updates cannot refresh or bias the pair');

const old = [point(now - 13 * 3600000, 10, 10.3)];
model = buildSpreadModel(old, quotes(10, 10.5), 30, now);
assert(model.pending && model.stale); close(model.latest.checks, 10.3);
assert.equal(buildSpreadModel(old, quotes(10, 10.3), 30, now).pending, false);
assert.equal(buildSpreadModel(old, null, 30, now).stale, true);
assert.equal(buildSpreadModel(data.slice(-7), quotes(10, 10.5), 7, now).reference, null, 'Six previous days are insufficient');
assert.equal(buildSpreadModel(data.slice(-8), quotes(10, 10.5), 30, now).reference.days, 7);
console.log('PASS: older shared snapshots stay visible honestly, mismatched current quotes cannot fabricate a pairing and reference requires seven prior days');

model = buildSpreadModel([point(now - 1000, 10, 9.7)], quotes(10, 9.7), 30, now);
close(model.latest.gap, -.3); close(model.latest.premium, -3);
assert.match(spreadReading(model).headline, /أقل.*0.30 د.ل/); assert.match(spreadReading(model).detail, /يقل 300.00/);
assert.match(spreadReading(model).movement, /نحتاج رصدين/);
model = buildSpreadModel([point(now - 1000, 10, 10)], quotes(10, 10), 30, now);
assert.equal(model.latest.gap, 0); assert.match(spreadReading(model).headline, /بنفس السعر/); assert.equal(spreadNumber(-0), '0.00');
assert.match(spreadReading(model).detail, /ما فيش فرق في المقابل/);
model = buildSpreadModel([point(now - day, 10, 9.5), point(now - 1000, 10, 9.8)], quotes(10, 9.8), 30, now);
assert.match(spreadReading(model).movement, /ضاقت بـ 0.30 د.ل.*من 0.50 إلى 0.20/, 'A smaller negative difference is narrowing, not widening');
model = buildSpreadModel([point(now - day, 10, 10.5), point(now - 1000, 10, 9.8)], quotes(10, 9.8), 30, now);
assert.match(spreadReading(model).movement, /ترتيب السعرين تبدّل.*الصك كان أعلى بـ 0.50.*الكاش أعلى بـ 0.20/);
model = buildSpreadModel([point(now - 1000, 10, 10.0001)], quotes(10, 10.0001), 30, now);
assert.equal(spreadNumber(model.latest.gap, true), '+0.0001'); assert.equal(spreadNumber(model.latest.premium, true), '+0.001');
assert.match(spreadReading(model).detail, /0.10 د.ل/);
assert.match(spreadReading(model).headline, /0.0001 د.ل/);
console.log('PASS: negative/zero spreads, signed direction, sign crossing and 0.0001 precision without premature rounding');

model = buildSpreadModel([point(now - day, 10, 9.5), point(now - 1000, 10, 10.2)], quotes(10, 10.2), 30, now);
assert.match(spreadReading(model).movement, /الكاش كان أعلى بـ 0.50.*الصك أعلى بـ 0.20/);
model = buildSpreadModel([point(now - day, 10, 10.2), point(now - 3600000, 10, 11), point(now - 1000, 10, 10.2)], quotes(10, 10.2), 30, now);
assert.match(spreadReading(model).movement, /رجع لقيمة البداية.*لكنه تحرّك بين \+0.20 و\+1.00/);
model = buildSpreadModel([point(now - day, 10, 10.2), point(now - 1000, 10, 10.2)], quotes(10, 10.2), 30, now);
assert.match(spreadReading(model).movement, /ما رصدناش تغيّر.*بين أول وآخر رصد/);
model = buildSpreadModel([point(now - day, 11, 11.2), point(now - 1000, 10, 10.5)], quotes(10, 10.5), 30, now);
assert.match(spreadReading(model).movement, /الفجوة كبرت بـ 0.30/);
assert(!/ارتفاع الدولار|الدولار ارتفع/.test(spreadReading(model).movement), 'A wider spread cannot be presented as a dollar rise when both quotes fell');
model = buildSpreadModel([point(now - day, 10, 10.2), point(now - 1000, 10, 10)], quotes(10, 10), 30, now);
assert.match(spreadReading(model).movement, /ضاقت بـ 0.20.*من 0.20 إلى 0.00/);
assert.match(spreadReading(model).comparison, /تحتاج 7 أيام رصد سابقة/);
assert(!/Infinity|NaN/.test(JSON.stringify(spreadReading(buildSpreadModel([point(now, 1e308, 1e308)], quotes(1e308, 1e308), 30, now)))));
console.log('PASS: approachable fact-based readings handle both crossings, endpoints, zero, insufficient observations and non-finite scaled examples without inventing market causes');

const sharedPair = getSpreadHistory([point(now, 10.245, 10.745)], now)[0];
const scaled = compareSpreadAmount(sharedPair, '1000');
close(scaled.cash, 10245); close(scaled.checks, 10745); close(scaled.gap, 500);
close(compareSpreadAmount(sharedPair, '1.25').gap, .625);
assert.equal(compareSpreadAmount(sharedPair, '0').gap, 0);
close(compareSpreadAmount({ ...sharedPair, checks: 9.745 }, '1000').gap, -500);
assert.equal(compareSpreadAmount({ ...sharedPair, checks: sharedPair.cash }, '1000').gap, 0);
for (const input of ['', ' ', '-1', 'NaN', 'Infinity', '1,000', String(SPREAD_MAX_AMOUNT + 1)]) assert.equal(compareSpreadAmount(sharedPair, input), null, input);
assert.equal(compareSpreadAmount(null, '1000'), null);
assert.equal(compareSpreadAmount({ ...sharedPair, cash: NaN }, '1000'), null);
assert.equal(compareSpreadAmount({ ...sharedPair, checks: 0 }, '1000'), null);
assert.equal(compareSpreadAmount({ ...sharedPair, cash: 1e308, checks: 1e308 }, '1000'), null);
assert.equal(compareSpreadAmount(sharedPair, String(SPREAD_MAX_AMOUNT)).amount, SPREAD_MAX_AMOUNT);
assert.match(spreadReading(model).priceMovement, /سعر الكاش لم يتغيّر.*سعر الصكوك نقص/);
console.log('PASS: user amount uses shared raw prices before rounding, handles decimals/zero/negative gaps and rejects missing, invalid, unsafe or excessive amounts');

const unequalDays = [point(now - day, 10, 11), point(now - 1000, 10, 10.2), point(now - 2000, 10, 10.2), point(now - 3000, 10, 10.2)];
model = buildSpreadModel(unequalDays, quotes(10, 10.2), 7, now); close(model.meanGap, .6);
const sameHour = [point(now - 1000, 10, 11), point(now - 2000, 20, 21)];
model = buildSpreadModel(sameHour, quotes(10, 11), 1, now);
const bin = model.bins.find(bin => bin.count); close(bin.premium, 7.5); close(bin.gap, 1);
const corrected = data.map((row, i) => i === 20 ? point(row.time, 10, 11.5) : row);
const peak = buildSpreadModel(corrected, quotes(10, 10.5), 30, now); close(peak.max, 1.5);
assert(buildSpreadModel(data, quotes(10, 10.5), 30, now).max < peak.max);
const empty = buildSpreadModel([], null, 30, now);
assert.equal(empty.latest, null); assert.equal(empty.meanGap, null); assert.equal(empty.change, null);
assert(empty.bins.every(bin => bin.gap === null)); assert.match(spreadReading(empty).headline, /بانتظار/);
console.log('PASS: daily weighting, per-snapshot ratios, raw extrema, correction rebuilds and unavailable values remain unavailable');
