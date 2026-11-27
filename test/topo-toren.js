/**
 * Torenverdediging: maps, place, upgrade, economy, wave, win.
 *   NODE_PATH=... node test/topo-toren.js
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
  function fail(msg) { console.log('FAIL ' + msg); failed += 1; }

  const report = await page.evaluate(function () {
    var out = [];
    function assert(cond, msg) { out.push((cond ? 'OK ' : 'FAIL ') + msg); }
    var t = window.__torenTest;
    if (!t) { out.push('FAIL no __torenTest'); return out; }
    t.resetProgress();
    var pr = t.getProgress();
    assert(pr.unlocked.gras && !pr.unlocked.zand && !pr.unlocked.ijs, 'alleen Grasveld is vrij');
    assert(t.maps.length === 3, '3 kaarten (kreeg ' + t.maps.length + ')');
    assert(t.maps[0].id === 'gras' && t.maps[1].id === 'zand' && t.maps[2].id === 'ijs', 'Grasveld, Woestijn, IJswereld');
    assert(t.maps[0].paths.length === 1, 'Grasveld heeft 1 pad');
    assert(t.maps[1].paths[0].length >= t.maps[0].paths[0].length + 2, 'Woestijn is langer (meer bochten)');
    assert(t.maps[2].paths.length === 2, 'IJswereld heeft een gesplitst pad (2 routes)');
    assert(t.types.length === 4, '4 torentypes');

    t.start('easy', false, 'gras');
    var st = t.getState();
    assert(st.coins === 80, 'makkelijk start met 80 munten (kreeg ' + st.coins + ')');
    assert(st.lives === 5, 'makkelijk start met 5 levens (kreeg ' + st.lives + ')');
    assert(st.nTowers === 0, 'nog geen torens');

    var okPlace = t.place(0, 'pijl');
    st = t.getState();
    assert(okPlace && st.nTowers === 1 && st.towers[0].type === 'pijl' && st.towers[0].level === 1, 'pijltoren geplaatst');
    assert(st.coins === 60, 'munten 80-20=60 (kreeg ' + st.coins + ')');

    var tooDear = t.place(1, 'bliksem');
    st = t.getState();
    assert(!tooDear && st.nTowers === 1 && st.coins === 60, 'te dure toren wordt geweigerd');

    var up = t.upgrade(0);
    st = t.getState();
    assert(up && st.towers[0].level === 2 && st.coins === 40, 'upgrade naar niveau 2 (munten 40, kreeg ' + st.coins + ')');
    t.upgrade(0);
    st = t.getState();
    assert(st.towers[0].level === 3, 'upgrade naar niveau 3');
    var noMore = t.upgrade(0);
    assert(!noMore && t.getState().towers[0].level === 3, 'niet hoger dan niveau 3');

    var coinsBeforeSell = t.getState().coins;
    var sold = t.sell(0);
    st = t.getState();
    assert(sold && st.nTowers === 0 && st.coins > coinsBeforeSell, 'verkopen geeft munten terug (nu ' + st.coins + ')');

    t.place(0, 'pijl');
    t.place(2, 'kanon');
    var started = t.startWave();
    st = t.getState();
    assert(started && st.wave === 1 && st.waveOn, 'golf 1 gestart');
    t.step(6);
    st = t.getState();
    assert(st.nMonsters >= 1 || st.coins > 80 || !st.waveOn, 'golf loopt of is afgerond (monsters=' + st.nMonsters + ', munten=' + st.coins + ')');

    t.forceWin();
    st = t.getState();
    pr = t.getProgress();
    assert(st.over && st.winner === 1, 'winst na alle golven');
    var ov = document.getElementById('overlay-toren');
    assert(ov && (' ' + ov.className + ' ').indexOf(' is-hidden ') === -1, 'winstscherm zichtbaar');
    var title = document.getElementById('toren-ov-title');
    assert(title && title.textContent.indexOf('Gewonnen') !== -1, 'winsttekst: ' + (title && title.textContent));
    assert(pr.unlocked.zand, 'Woestijn gaat open na winst op Grasveld');
    assert(!pr.unlocked.ijs, 'IJswereld blijft dicht tot Woestijn is gewonnen');
    assert(pr.stars.gras >= 1, 'minstens 1 ster op Grasveld (kreeg ' + pr.stars.gras + ')');

    t.start('easy', false, 'ijs');
    st = t.getState();
    assert(st.nPaths === 2, 'IJswereld-spel heeft 2 paden (kreeg ' + st.nPaths + ')');
    return out;
  });

  var i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  try {
    await page.evaluate(function () { window.__torenTest.resetProgress(); });
    await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.click('#btn-goto-toren');
    await page.waitForSelector('#screen-torenkaarten:not(.is-hidden)', { timeout: 8000 });
    var maps = await page.evaluate(function () {
      var g = document.getElementById('toren-kaart-gras');
      var z = document.getElementById('toren-kaart-zand');
      var ijs = document.getElementById('toren-kaart-ijs');
      return {
        title: (document.querySelector('#screen-torenkaarten .prompt') || {}).textContent,
        zandLocked: z && (' ' + z.className + ' ').indexOf(' is-locked ') !== -1,
        ijsLocked: ijs && (' ' + ijs.className + ' ').indexOf(' is-locked ') !== -1,
        grasLocked: g && (' ' + g.className + ' ').indexOf(' is-locked ') !== -1
      };
    });
    if (maps.title.indexOf('Torenverdediging') === -1) fail('kaarttitel ontbreekt: ' + maps.title);
    else ok('kaartenscherm: ' + maps.title.trim());
    if (maps.grasLocked || !maps.zandLocked || !maps.ijsLocked) fail('slotten kloppen niet: ' + JSON.stringify(maps));
    else ok('Grasveld open, Woestijn en IJswereld op slot');

    await page.click('#toren-kaart-gras');
    await page.waitForSelector('#screen-torenlevel:not(.is-hidden)', { timeout: 8000 });
    var lvl = await page.evaluate(function (vh) {
      var btns = document.querySelectorAll('#torenlevel-grid .level-btn');
      var i, b, items = [], tops = [];
      for (i = 0; i < btns.length; i++) {
        b = btns[i].getBoundingClientRect();
        items.push({ w: b.width, h: b.height, top: b.top, bottom: b.bottom });
        tops.push(Math.round(b.top));
        if (b.bottom > vh + 0.5) return { err: 'clipped' };
      }
      return { n: btns.length, items: items, tops: tops, title: (document.getElementById('torenlevel-title') || {}).textContent };
    }, 768);
    if (lvl.err) fail('niveauknoppen ' + lvl.err);
    else if (lvl.n !== 3) fail('verwacht 3 niveauknoppen');
    else if (lvl.items.some(function (b) { return b.h < 44 || b.h > 56; })) fail('niveauknoppen te groot: ' + JSON.stringify(lvl.items));
    else if (Math.max.apply(null, lvl.tops) - Math.min.apply(null, lvl.tops) > 4) fail('niveauknoppen niet op één rij');
    else ok('compacte niveauknoppen ' + lvl.items.map(function (b) { return Math.round(b.w) + 'x' + Math.round(b.h); }).join(', ') + ' op ' + (lvl.title || ''));

    await page.click('#torenlevel-grid [data-kind="easy"]');
    await page.waitForSelector('#screen-toren:not(.is-hidden)', { timeout: 8000 });
    await wait(150);
    var coins = await page.evaluate(function () { return document.getElementById('toren-coins').textContent; });
    if (coins !== '80') fail('HUD munten ' + coins);
    else ok('HUD toont 80 munten');
  } catch (err) {
    fail(err && err.message ? err.message : String(err));
  }

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL TOREN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
