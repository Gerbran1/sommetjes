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

  async function ghostBox() {
    return page.evaluate(() => {
      var g = document.querySelector('.topo-ghost');
      if (!g) return null;
      var b = g.getBoundingClientRect();
      return { left: b.left, top: b.top, w: b.width, h: b.height };
    });
  }

  async function assertGhostFollowsTouch(sel, label) {
    var piece = await page.$(sel);
    if (!piece) throw new Error(label + ': stuk niet gevonden (' + sel + ')');
    var r = await piece.boundingBox();
    if (!r) throw new Error(label + ': geen bounding box');
    var x0 = r.x + r.width * 0.3;
    var y0 = r.y + Math.min(r.height * 0.35, 28);
    await page.touchscreen.touchStart(x0, y0);
    await new Promise(function (res) { setTimeout(res, 40); });
    var g1 = await ghostBox();
    if (!g1) {
      await page.touchscreen.touchEnd();
      throw new Error(label + ': geen sleepstuk na touchStart');
    }
    var dx = 90, dy = -50;
    await page.touchscreen.touchMove(x0 + dx, y0 + dy);
    await new Promise(function (res) { setTimeout(res, 40); });
    var g2 = await ghostBox();
    await page.touchscreen.touchEnd();
    if (!g2) throw new Error(label + ': geen sleepstuk na touchMove');
    var gotX = g2.left - g1.left;
    var gotY = g2.top - g1.top;
    if (Math.abs(gotX - dx) > 3 || Math.abs(gotY - dy) > 3) {
      throw new Error(label + ' volgt de vinger niet: dx=' + gotX.toFixed(1) + ' (wil ' + dx + '), dy=' + gotY.toFixed(1) + ' (wil ' + dy + ')');
    }
    ok(label + ' volgt de vinger (delta ' + Math.round(gotX) + ',' + Math.round(gotY) + ')');
  }

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  await page.click('#btn-goto-topo');
  await page.waitForSelector('#topo-grid [data-game="puzzel"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="puzzel"]');
  await page.waitForSelector('#topolevel-grid [data-kind="easy"]', { timeout: 8000 });
  await page.click('#topolevel-grid [data-kind="easy"]');
  await page.waitForSelector('#screen-topopuzzel:not(.is-hidden)', { timeout: 8000 });
  try {
    await assertGhostFollowsTouch('#topo-tray .topo-piece[data-topo-id="nl"], #topo-tray .topo-piece', 'Europa-sleep');
  } catch (err) {
    console.log('FAIL ' + (err && err.message ? err.message : err));
    failed += 1;
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
