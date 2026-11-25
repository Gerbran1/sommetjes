/**
 * Oceanen: data, drop-hit and drag-follow.
 *   NODE_PATH=... node test/topo-oceanen.js
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
    if (!t || !t.oceanen || !t.dropHit || !t.startDrop) {
      out.push('FAIL no __topoTest ocean hooks');
      return out;
    }
    t.getState().game = 'ocean';
    t.getState().placed = {};
    var i, o, hit, names = {}, need;
    assert(t.oceanen.length === 5, '5 oceanen (kreeg ' + t.oceanen.length + ')');
    assert(t.oceanVbW === 1100 && t.oceanVbH === 574, 'wereld-viewBox ' + t.oceanVbW + 'x' + t.oceanVbH);
    need = {
      pacific: 'Stille Oceaan',
      atlantic: 'Atlantische Oceaan',
      indian: 'Indische Oceaan',
      arctic: 'Noordelijke IJszee',
      southern: 'Zuidelijke Oceaan'
    };
    for (i = 0; i < t.oceanen.length; i++) {
      o = t.oceanen[i];
      names[o.id] = o.name;
      assert(!!need[o.id], o.id + ' is een bekende oceaan');
      assert(o.name === need[o.id], o.id + ' heet ' + o.name);
      assert(!!o.path && o.path.charAt(0) === 'M', o.id + ' heeft pad');
      assert(!!o.audio && o.audio.indexOf('zee-') === 0, o.id + ' audio');
      assert(o.r >= 60, o.id + ' snapstraal ' + o.r);
      hit = t.dropHit(o.cx, o.cy);
      assert(hit && hit.id === o.id, o.id + ' hit op eigen anker, niet ' + (hit && hit.id));
      if (o.cx2 != null && (o.cx2 !== o.cx || o.cy2 !== o.cy)) {
        hit = t.dropHit(o.cx2, o.cy2);
        assert(hit && hit.id === o.id, o.id + ' hit op tweede anker, niet ' + (hit && hit.id));
      }
      hit = t.dropHit(o.cx + 3000, o.cy + 3000);
      assert(!hit, o.id + ' geen hit ver weg');
    }
    assert(names.pacific && names.arctic && names.southern, 'Stille, Noordelijke IJszee en Zuidelijke Oceaan aanwezig');
    return out;
  });

  async function ghostBox() {
    return page.evaluate(() => {
      var g = document.querySelector('.topo-label.is-ghost, .topo-ghost');
      if (!g) return null;
      var b = g.getBoundingClientRect();
      return { left: b.left, top: b.top, w: b.width, h: b.height };
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
  await page.waitForSelector('#topo-grid [data-game="ocean"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="ocean"]');
  try {
    await page.waitForSelector('#screen-topodrop:not(.is-hidden)', { timeout: 8000 });
    ok('Oceanen start direct, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Oceanen start niet direct');
    failed += 1;
  }
  var levelOpen = await page.evaluate(function () {
    var el = document.getElementById('screen-topolevel');
    return el && (' ' + el.className + ' ').indexOf(' is-hidden ') === -1;
  });
  if (levelOpen) {
    console.log('FAIL Oceanen toont een niveaukiezer');
    failed += 1;
  }
  var nLabels = await page.$$eval('#topo-drop-tray-inner .topo-label', function (els) { return els.length; });
  if (nLabels !== 5) {
    console.log('FAIL bak heeft ' + nLabels + ' labels, wil 5');
    failed += 1;
  } else {
    ok('bak toont alle 5 oceaannamen');
  }
  try {
    await assertGhostFollowsTouch('#topo-drop-tray-inner .topo-label', 'Oceanen-label');
  } catch (err) {
    console.log('FAIL ' + err.message);
    failed += 1;
  }

  await browser.close();
  if (failed) {
    console.log('FAILED ' + failed);
    process.exit(1);
  }
  console.log('ALL OCEANEN CHECKS OK');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
