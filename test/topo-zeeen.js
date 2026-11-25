/**
 * Zeeën rond Europa: data, drop-hit, batch tray and drag-follow.
 *   NODE_PATH=... node test/topo-zeeen.js
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
  const url = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  const report = await page.evaluate(() => {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t || !t.zeeen || !t.dropHit || !t.startDrop) {
      out.push('FAIL no __topoTest zee hooks');
      return out;
    }
    t.getState().game = 'zee';
    t.getState().placed = {};
    var i, o, hit, names = {}, need, byId = {};
    need = {
      noordzee: 'Noordzee',
      oostzee: 'Oostzee',
      med: 'Middellandse Zee',
      zwart: 'Zwarte Zee',
      atl: 'Atlantische Oceaan',
      noors: 'Noorse Zee',
      barents: 'Barentszzee',
      adria: 'Adriatische Zee',
      biskaje: 'Golf van Biskaje',
      kanaal: 'Het Kanaal',
      iers: 'Ierse Zee',
      egeisch: 'Egeïsche Zee',
      kaspisch: 'Kaspische Zee'
    };
    assert(t.zeeen.length === 13, '13 zeeën (kreeg ' + t.zeeen.length + ')');
    assert(t.zeeVbW >= 1000 && t.zeeVbH >= 700, 'zee-viewBox ' + t.zeeVbW + 'x' + t.zeeVbH);
    for (i = 0; i < t.zeeen.length; i++) {
      o = t.zeeen[i];
      byId[o.id] = o;
      names[o.id] = o.name;
      assert(!!need[o.id], o.id + ' is een bekende zee');
      assert(o.name === need[o.id], o.id + ' heet ' + o.name);
      assert(!!o.path && o.path.charAt(0) === 'M', o.id + ' heeft pad');
      assert(!!o.audio && o.audio.indexOf('zee-') === 0, o.id + ' audio');
      hit = t.dropHit(o.cx, o.cy);
      assert(hit && hit.id === o.id, o.id + ' hit op eigen anker, niet ' + (hit && hit.id));
      hit = t.dropHit(o.cx + 3000, o.cy + 3000);
      assert(!hit, o.id + ' geen hit ver weg');
    }
    // Channel should not steal the North Sea, and vice versa
    hit = t.dropHit(byId.kanaal.cx, byId.kanaal.cy);
    assert(hit && hit.id === 'kanaal', 'Kanaal-anker blijft Het Kanaal, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.noordzee.cx, byId.noordzee.cy);
    assert(hit && hit.id === 'noordzee', 'Noordzee-anker blijft Noordzee, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.iers.cx, byId.iers.cy);
    assert(hit && hit.id === 'iers', 'Ierse Zee-anker blijft Ierse Zee, niet ' + (hit && hit.id));
    return out;
  });

  async function ghostBox() {
    return page.evaluate(() => {
      var g = document.querySelector('.topo-label.is-ghost, .topo-ghost');
      if (!g) return null;
      var b = g.getBoundingClientRect();
      return { left: b.left, top: b.top };
    });
  }

  async function assertGhostFollowsTouch(sel, label) {
    var piece = await page.$(sel);
    if (!piece) throw new Error(label + ': label niet gevonden (' + sel + ')');
    var r = await piece.boundingBox();
    if (!r) throw new Error(label + ': geen bounding box');
    var x0 = r.x + r.width * 0.4;
    var y0 = r.y + r.height * 0.5;
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
  await page.waitForSelector('#topo-grid [data-game="zee"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="zee"]');
  try {
    await page.waitForSelector('#screen-topodrop:not(.is-hidden)', { timeout: 8000 });
    ok('Zeeën rond Europa start direct, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Zeeën start niet direct');
    failed += 1;
  }
  var nLabels = await page.$$eval('#topo-drop-tray-inner .topo-label', function (els) { return els.length; });
  if (nLabels !== 7) {
    console.log('FAIL bak heeft ' + nLabels + ' labels, wil 7');
    failed += 1;
  } else {
    ok('bak toont 7 namen in de eerste ronde');
  }
  try {
    await assertGhostFollowsTouch('#topo-drop-tray-inner .topo-label', 'Zee-label');
  } catch (err) {
    console.log('FAIL ' + err.message);
    failed += 1;
  }

  await browser.close();
  if (failed) {
    console.log('FAILED ' + failed);
    process.exit(1);
  }
  console.log('ALL ZEEEN CHECKS OK');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
