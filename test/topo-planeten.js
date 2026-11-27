/**
 * Planeten veroveren: swipe-send, capture, AI, win, fps.
 *   NODE_PATH=... node test/topo-planeten.js
 */
'use strict';
const puppeteer = require('puppeteer-core');

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768, isMobile: true, hasTouch: true, isLandscape: true });
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  var failed = 0;

  function fail(msg) {
    console.log('FAIL ' + msg);
    failed += 1;
  }

  const report = await page.evaluate(function () {
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    var t = window.__planetenTest;
    if (!t) {
      out.push('FAIL no __planetenTest');
      return out;
    }
    t.start('easy', false);
    var st = t.getState();
    assert(st.nPlanets >= 10 && st.nPlanets <= 15, 'makkelijk heeft ' + st.nPlanets + ' planeten (10-15)');
    assert(t.planet(0) && t.planet(0).owner === 1, 'planeet 0 is van de speler');
    assert(t.planet(1) && t.planet(1).owner === 2, 'planeet 1 is van de computer');
    assert(t.planet(2) && t.planet(2).owner === 0, 'planeet 2 is neutraal');
    var before = t.planet(0).units;
    var sent = t.send(0, 2, null);
    assert(sent, 'programmatisch half wegsturen lukt');
    st = t.getState();
    assert(st.nFleets === 1, 'er vliegt 1 vloot (kreeg ' + st.nFleets + ')');
    assert(t.planet(0).units === Math.floor(before / 2) || t.planet(0).units === before - Math.floor(before / 2),
      'helft blijft achter (was ' + before + ', nu ' + t.planet(0).units + ')');
    var guard = 0;
    while (t.getState().nFleets > 0 && !t.getState().over && guard < 80) {
      t.step(0.2);
      guard += 1;
    }
    assert(t.planet(2).owner === 1, 'neutrale planeet is veroverd (owner ' + (t.planet(2) && t.planet(2).owner) + ')');
    assert(t.planet(2).units > 0, 'veroverde planeet heeft eenheden');

    t.start('easy', false);
    var fleetsBefore = t.getState().nFleets;
    t.tickAI(2);
    st = t.getState();
    assert(st.nFleets > fleetsBefore || st.nFleets >= 1, 'AI stuurt een vloot (kreeg ' + st.nFleets + ')');
    var aiFleet = null;
    var i;
    for (i = 0; i < st.fleets.length; i++) {
      if (st.fleets[i].owner === 2) aiFleet = st.fleets[i];
    }
    assert(!!aiFleet, 'er is een rode vloot');

    t.start('hard', false);
    st = t.getState();
    assert(st.nPlanets === 15, 'moeilijk heeft 15 planeten (kreeg ' + st.nPlanets + ')');
    var hasAi2 = false;
    for (i = 0; i < st.planets.length; i++) {
      if (st.planets[i].owner === 3) hasAi2 = true;
    }
    assert(hasAi2, 'moeilijk heeft een tweede computer');

    t.start('easy', false);
    t.forceWin();
    st = t.getState();
    assert(st.over && st.winner === 1, 'winst als alle vijandelijke planeten (en vloten) weg zijn');
    var ov = document.getElementById('overlay-planeten');
    assert(ov && (' ' + ov.className + ' ').indexOf(' is-hidden ') === -1, 'winstscherm is zichtbaar');
    var title = document.getElementById('planeten-ov-title');
    assert(title && title.textContent.indexOf('Gewonnen') !== -1, 'winsttekst: ' + (title && title.textContent));
    return out;
  });

  var i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  try {
    await page.click('#btn-planeten-naar-start');
    await wait(200);
    await page.click('#btn-goto-planeten');
    await page.waitForSelector('#screen-planetenlevel:not(.is-hidden)', { timeout: 8000 });
    var levelTitle = await page.evaluate(function () {
      var p = document.querySelector('#screen-planetenlevel .prompt');
      return p ? p.textContent : '';
    });
    if (levelTitle.indexOf('Planeten veroveren') === -1) fail('niveautitel ontbreekt: ' + levelTitle);
    else ok('niveauscherm: ' + levelTitle.trim());
    await page.click('#planetenlevel-grid [data-kind="easy"]');
    await page.waitForSelector('#screen-planeten:not(.is-hidden)', { timeout: 8000 });
    await wait(200);
    var pts = await page.evaluate(function () {
      var t = window.__planetenTest;
      var a = t.planet(0);
      var b = t.planet(2);
      return {
        from: t.worldToClient(a.x, a.y),
        to: t.worldToClient(b.x, b.y),
        before: a.units,
        owner2: b.owner
      };
    });
    await page.touchscreen.touchStart(pts.from.x, pts.from.y);
    await wait(30);
    await page.touchscreen.touchMove((pts.from.x + pts.to.x) / 2, (pts.from.y + pts.to.y) / 2);
    await wait(30);
    await page.touchscreen.touchMove(pts.to.x, pts.to.y);
    await wait(30);
    await page.touchscreen.touchEnd();
    await wait(80);
    var afterSwipe = await page.evaluate(function () {
      var t = window.__planetenTest;
      return { fleets: t.getState().nFleets, units0: t.planet(0).units, beforeHint: t.getState().hintOn };
    });
    if (afterSwipe.fleets < 1) fail('swipe stuurde geen vloot (fleets=' + afterSwipe.fleets + ')');
    else ok('swipe stuurt een vloot (helft van ' + pts.before + ' blijft ' + afterSwipe.units0 + ')');
    await page.evaluate(function () { window.__planetenTest.step(8); });
    var captured = await page.evaluate(function () {
      var p = window.__planetenTest.planet(2);
      return p ? p.owner : -1;
    });
    if (captured !== 1) fail('swipe-verovering mislukt, owner=' + captured);
    else ok('swipe verovert de neutrale planeet');
  } catch (err) {
    fail(err && err.message ? err.message : String(err));
  }

  try {
    var fps = await page.evaluate(function () {
      var t = window.__planetenTest;
      t.start('normal', false);
      var i;
      for (i = 0; i < 6; i++) t.send(0, 4 + (i % 5), null);
      t.tickAI(2);
      var start = t.getState().frameCount;
      var t0 = new Date().getTime();
      return new Promise(function (resolve) {
        setTimeout(function () {
          var n = t.getState().frameCount - start;
          var ms = new Date().getTime() - t0;
          resolve({ frames: n, ms: ms, fps: n / (ms / 1000) });
        }, 1000);
      });
    });
    if (fps.fps < 25) fail('fps te laag op iPad-formaat: ' + fps.fps.toFixed(1) + ' (' + fps.frames + ' frames in ' + fps.ms + 'ms)');
    else ok('prestatie iPad 1024x768: ' + fps.fps.toFixed(1) + ' fps (' + fps.frames + ' frames)');
  } catch (err) {
    fail('fps: ' + (err && err.message ? err.message : err));
  }

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL PLANETEN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
