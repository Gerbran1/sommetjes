/**
 * Puzzle snap logic and Europe map data for Topografie.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/topo-puzzel.js
 */
const puppeteer = require('puppeteer-core');

function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  const report = await page.evaluate(() => {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t) {
      out.push('FAIL no __topoTest');
      return out;
    }
    var easyP = t.idsWhere('easyP');
    var hardP = t.idsWhere('hardP');
    assert(easyP.length === 8, 'makkelijk puzzel heeft ' + easyP.length + ' landen (8)');
    assert(hardP.length >= 20, 'moeilijk puzzel heeft ' + hardP.length + ' landen (>=20)');
    var need = ['nl', 'be', 'de', 'fr', 'es', 'it', 'gb', 'pl'];
    var i, id, land, hit, r;
    for (i = 0; i < need.length; i++) {
      assert(easyP.indexOf(need[i]) !== -1, 'makkelijk bevat ' + need[i]);
    }
    assert(t.vbW > 0 && t.vbH > 0, 'viewBox ' + t.vbW + 'x' + t.vbH);
    assert(t.landen.length >= 30, 'kaart heeft ' + t.landen.length + ' landen (>=30)');
    for (i = 0; i < t.landen.length; i++) {
      land = t.landen[i];
      assert(!!land.id && !!land.name && !!land.path, land.id + ' heeft id/naam/pad');
      assert(land.path.indexOf('M') === 0 || land.path.indexOf('m') === 0, land.id + ' pad start met M');
      assert(land.w > 0 && land.h > 0, land.id + ' bbox ' + land.w + 'x' + land.h);
      if (land.easyP || land.hardP) {
        assert(!!land.audio && land.audio.indexOf('land-') === 0, land.id + ' audio ' + land.audio);
        assert(land.color && land.color.charAt(0) === '#', land.id + ' kleur');
        r = t.snapRadius(land);
        assert(r >= 28, land.id + ' snapstraal ' + r + ' (>=28)');
        hit = t.pickSnap(land.cx, land.cy, [land.id]);
        assert(hit && hit.id === land.id, land.id + ' snap op eigen centroid');
        hit = t.pickSnap(land.cx + 2000, land.cy + 2000, [land.id]);
        assert(!hit, land.id + ' geen snap ver weg');
      }
    }
    var nl = t.landById('nl');
    var be = t.landById('be');
    assert(!!nl && !!be, 'NL en BE bestaan');
    hit = t.pickSnap(nl.cx, nl.cy, ['nl', 'be']);
    assert(hit && hit.id === 'nl', 'centroid NL kiest NL, niet BE (kreeg ' + (hit && hit.id) + ')');
    hit = t.pickSnap(be.cx, be.cy, ['nl', 'be']);
    assert(hit && hit.id === 'be', 'centroid BE kiest BE, niet NL (kreeg ' + (hit && hit.id) + ')');
    assert(t.pointInBox(nl.cx, nl.cy, nl, 8), 'NL centroid zit in NL-bbox');
    var lu = t.landById('lu');
    assert(lu && !lu.easyP && !lu.hardP, 'Luxemburg is vooraf ingevuld (te klein)');
    return out;
  });
  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL TOPO PUZZEL CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
