const assert = require('node:assert/strict');

function assertSmoothCurve(path) {
  assert(path && !/NaN|Infinity/.test(path), 'Curve is finite and nonblank');
  let point, anchors = 0, groupSize = 0, curved = false;
  const checkGroup = () => { if (groupSize >= 3) assert(curved, 'Three or more shared points use a curved path'); };
  for (const [, command, body] of path.matchAll(/([MLC])([^MLC]*)/g)) {
    const values = body.trim().split(/[\s,]+/).map(Number);
    assert(values.every(Number.isFinite));
    assert.equal(values.length, command === 'C' ? 6 : 2);
    if (command === 'M') { checkGroup(); groupSize = 0; curved = false; }
    if (command === 'C') {
      assert(point); curved = true;
      // Bounded Bezier controls keep every smoothed segment inside its real endpoints.
      for (const axis of [0, 1]) for (const control of [axis, axis + 2]) {
        const lower = Math.min(point[axis], values[axis + 4]), upper = Math.max(point[axis], values[axis + 4]);
        assert(values[control] >= lower - .002 && values[control] <= upper + .002, 'Smoothing cannot invent an overshooting high or low');
      }
    }
    point = values.slice(-2); anchors++; groupSize++;
  }
  checkGroup();
  return anchors;
}
module.exports = { assertSmoothCurve };

if (require.main === module) {
  assert.equal(assertSmoothCurve('M0,10C3,10,7,0,10,0C13,0,17,10,20,10'), 3);
  assert.equal(assertSmoothCurve('M0,0L10,10M20,0L30,10'), 4);
  assert.throws(() => assertSmoothCurve('M0,10C3,30,7,0,10,0'));
  assert.throws(() => assertSmoothCurve('M0,0L10,10L20,0'));
  const { buildSync } = require('esbuild');
  const vm = require('node:vm');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const code = buildSync({ entryPoints: ['src/components/charts/PriceChartTooltip.tsx'], bundle: true,
    platform: 'node', format: 'cjs', packages: 'external', write: false }).outputFiles[0].text;
  const mod = { exports: {} };
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require, Date, Intl });
  const Tooltip = mod.exports.PriceChartTooltip;
  const props = { active: true, payload: [{ value: 6.4004, payload: { time: '2026-10-20T08:00:00Z' } }],
    caption: 'السعر', unit: 'د.ل', color: 'var(--positive)' };
  const render = patch => renderToStaticMarkup(React.createElement(Tooltip, { ...props, ...patch }));
  assert.match(render({}), /10:00/);
  assert.match(render({ decimals: 4 }), /6.4004/);
  assert(!render({ daily: true, decimals: 4 }).includes('10:00'), 'Official daily tooltips do not imply intraday prices');
  assert.match(render({ caption: '<script>unsafe</script>' }), /&lt;script&gt;/);
  assert.equal(render({ active: false }), '');
  for (const time of ['invalid', Infinity, 1e308, undefined]) assert.equal(render({ payload: [{ value: 10, payload: { time } }] }), '');
  for (const value of [NaN, Infinity, '10', null]) assert.equal(render({ payload: [{ value, payload: { time: 1792483200000 } }] }), '');
  console.log('PASS: bounded smooth geometry, raw anchor counts and gaps; shared price tooltip rejects invalid values, escapes labels, preserves four decimals and Tripoli daily/intraday dates');
}
