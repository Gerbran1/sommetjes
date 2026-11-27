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
    assert(pr.unlocked.gras && !pr.unlocked.zand && !pr.unlocked.ijs && !pr.unlocked.lava && !pr.unlocked.eiland, 'alleen Grasveld is vrij');
    assert(t.maps.length >= 5, 'minstens 5 kaarten (kreeg ' + t.maps.length + ')');
    assert(t.maps[0].id === 'gras' && t.maps[1].id === 'zand' && t.maps[2].id === 'ijs', 'Grasveld, Woestijn, IJswereld');
    assert(t.maps[3].id === 'lava' && t.maps[3].name === 'Lava', 'kaart 4 is Lava');
    assert(t.maps[4].id === 'eiland' && t.maps[4].name === 'Eilanden', 'kaart 5 is Eilanden');
    assert(t.maps[0].paths.length === 1, 'Grasveld heeft 1 pad');
    assert(t.maps[1].paths[0].length >= t.maps[0].paths[0].length + 2, 'Woestijn is langer (meer bochten)');
    assert(t.maps[2].paths.length === 2, 'IJswereld heeft een gesplitst pad (2 routes)');
    assert(t.maps[3].paths.length === 1 && t.maps[3].lava && t.maps[3].lava.length >= 3, 'Lava heeft lavarivieren en 1 pad');
    assert(t.maps[4].islands && t.maps[4].islands.length >= 5, 'Eilanden heeft minstens 5 eilanden');
    assert(t.types.length === 4, '4 torentypes');
    assert(t.mobs && t.mobs.slijm && t.mobs.looper && t.mobs.schildpad && t.mobs.draak, '4 monstertypes');
    assert(t.mobs.looper.name === 'Vleermuis', 'snelle vijand is een vleermuis (kreeg ' + (t.mobs.looper && t.mobs.looper.name) + ')');
    assert(t.mobs.slijm.name === 'Slijm', 'slijm houdt zijn naam');
    assert(t.mobs.schildpad.name === 'Schildpad', 'schildpad houdt zijn naam');
    assert(t.mobs.draak.name.indexOf('Draak') !== -1, 'baas is een draakje');
    var sprites = t.spriteInfo();
    assert(sprites.ready && sprites.towers.length === 16, '16 gecachte torensprites (kreeg ' + (sprites.towers && sprites.towers.length) + ')');
    assert(sprites.mobs.length === 16, '16 gecachte monstersprites (kreeg ' + (sprites.mobs && sprites.mobs.length) + ')');
    var smP = t.sampleTower('pijl', 1);
    var smI = t.sampleTower('ijs', 1);
    var smK = t.sampleTower('kanon', 1);
    var smB = t.sampleTower('bliksem', 1);
    assert(smP && smP.green > 4 && smP.brown > 3, 'pijltoren is hout met groen (g=' + (smP && smP.green) + ' br=' + (smP && smP.brown) + ')');
    assert(smI && smI.blue > 4, 'ijstoren is een ijsblauw kristal (bl=' + (smI && smI.blue) + ')');
    assert(smK && smK.brown > 2, 'kanon heeft hout/wielen (br=' + (smK && smK.brown) + ')');
    assert(smB && smB.yellow > 2, 'bliksemtoren (tesla) heeft geel (ye=' + (smB && smB.yellow) + ')');
    var moS = t.sampleMob('slijm');
    var moL = t.sampleMob('looper');
    var moT = t.sampleMob('schildpad');
    var moD = t.sampleMob('draak');
    assert(moS && moS.green > 4, 'slijm is groen');
    assert(moL && (moL.purple > 2 || moL.n > 8), 'vleermuis is paarsachtig');
    assert(moT && (moT.teal > 2 || moT.green > 2), 'schildpad heeft een schild');
    assert(moD && (moD.orange > 2 || moD.yellow > 2), 'draakje heeft kroon/oranje lijf');
    for (ti = 0; ti < t.types.length; ti++) {
      typ = t.types[ti];
      assert(typ.up.length === 4 && typ.range.length === 4 && typ.dmg.length === 4 && typ.rate.length === 4, typ.name + ' heeft 4 niveaus');
    }

    function hexRgb(h) {
      h = String(h || '').replace('#', '');
      if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    function distToSeg(px, py, ax, ay, bx, by) {
      var abx = bx - ax, aby = by - ay;
      var ab2 = abx * abx + aby * aby;
      var tt = ab2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / ab2;
      if (tt < 0) tt = 0;
      if (tt > 1) tt = 1;
      var cx = ax + tt * abx, cy = ay + tt * aby;
      return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
    }
    var pijl = null, ijsTyp = null, typ, ti, minRange, margin, mi, map, si, pi, path, sj, best, d, rgb, msg;
    minRange = Infinity;
    for (ti = 0; ti < t.types.length; ti++) {
      typ = t.types[ti];
      if (typ.id === 'pijl') pijl = typ;
      if (typ.id === 'ijs') ijsTyp = typ;
      if (typ.range[0] < minRange) minRange = typ.range[0];
    }
    assert(!!pijl && !!ijsTyp, 'pijl- en ijs-type bestaan');
    rgb = hexRgb(pijl.color);
    assert(rgb.g > rgb.r + 30 && rgb.g > rgb.b + 30, 'pijltorenkleur is duidelijk groen (kreeg ' + pijl.color + ')');
    rgb = hexRgb(pijl.dark);
    assert(rgb.g > rgb.r && rgb.g > rgb.b, 'pijltoren-donker is groen (kreeg ' + pijl.dark + ')');
    if (pijl.accent) {
      rgb = hexRgb(pijl.accent);
      assert(rgb.g > rgb.b + 20, 'pijl-accent is groen (kreeg ' + pijl.accent + ')');
    }
    rgb = hexRgb(ijsTyp.color);
    assert(rgb.b > rgb.r + 30 && rgb.b >= rgb.g, 'ijstoren blijft ijsblauw (kreeg ' + ijsTyp.color + ')');
    assert(pijl.color !== ijsTyp.color && pijl.dark !== ijsTyp.dark, 'pijl en ijs hebben andere kleuren');

    margin = 10;
    assert(t.maps && t.maps.length >= 3, 'minstens 3 kaarten (kreeg ' + (t.maps && t.maps.length) + ')');
    for (mi = 0; mi < t.maps.length; mi++) {
      map = t.maps[mi];
      assert(map.spots && map.spots.length, map.name + ' heeft bouwvlekken');
      assert(map.paths && map.paths.length, map.name + ' heeft paden');
      for (si = 0; si < map.spots.length; si++) {
        best = 1e9;
        for (pi = 0; pi < map.paths.length; pi++) {
          path = map.paths[pi];
          for (sj = 0; sj < path.length - 1; sj++) {
            d = distToSeg(map.spots[si].x, map.spots[si].y, path[sj].x, path[sj].y, path[sj + 1].x, path[sj + 1].y);
            if (d < best) best = d;
          }
        }
        msg = map.name + ' plek ' + si + ' (' + map.spots[si].x + ',' + map.spots[si].y + ') ligt ' + Math.round(best) + ' px van het pad (max ' + (minRange - margin) + ', bereik ' + minRange + ')';
        assert(best + margin <= minRange, msg);
        if (map.islands && map.islands.length) {
          var onLand = false, ii, isl, ddx, ddy, landR;
          for (ii = 0; ii < map.islands.length; ii++) {
            isl = map.islands[ii];
            ddx = map.spots[si].x - isl.x;
            ddy = map.spots[si].y - isl.y;
            landR = isl.r - 8;
            if (ddx * ddx + ddy * ddy <= landR * landR) onLand = true;
          }
          assert(onLand, map.name + ' plek ' + si + ' ligt op een eiland');
        }
      }
    }

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
    t.setCoins(80);
    var up4 = t.upgrade(0);
    st = t.getState();
    assert(up4 && st.towers[0].level === 4, 'upgrade naar niveau 4 (munten ' + st.coins + ')');
    var noMore = t.upgrade(0);
    assert(!noMore && t.getState().towers[0].level === 4, 'niet hoger dan niveau 4');
    t.openSpot(0);
    var shopTxt = (document.getElementById('toren-shop') || {}).textContent || '';
    assert(shopTxt.indexOf('niveau 4') !== -1, 'winkel toont niveau 4: ' + shopTxt.replace(/\s+/g, ' ').slice(0, 80));
    assert(shopTxt.indexOf('Hoogste niveau') !== -1, 'winkel toont hoogste niveau');
    assert(shopTxt.indexOf('Verkopen') !== -1 && shopTxt.indexOf('+') !== -1, 'winkel toont verkoopwaarde');

    var coinsBeforeSell = t.getState().coins;
    var sold = t.sell(0);
    st = t.getState();
    assert(sold && st.nTowers === 0 && st.coins === coinsBeforeSell + 60, 'verkopen niveau 4 geeft 60 munten terug (nu ' + st.coins + ')');

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
    assert(!pr.unlocked.ijs && !pr.unlocked.lava && !pr.unlocked.eiland, 'IJswereld, Lava en Eilanden blijven dicht tot de vorige is gewonnen');
    assert(pr.stars.gras >= 1, 'minstens 1 ster op Grasveld (kreeg ' + pr.stars.gras + ')');

    t.start('easy', false, 'zand');
    t.forceWin();
    pr = t.getProgress();
    assert(pr.unlocked.ijs, 'IJswereld gaat open na winst op Woestijn');
    assert(!pr.unlocked.lava && !pr.unlocked.eiland, 'Lava blijft dicht tot IJswereld is gewonnen');

    t.start('easy', false, 'ijs');
    st = t.getState();
    assert(st.nPaths === 2, 'IJswereld-spel heeft 2 paden (kreeg ' + st.nPaths + ')');
    t.forceWin();
    pr = t.getProgress();
    assert(pr.unlocked.lava, 'Lava gaat open na winst op IJswereld');
    assert(!pr.unlocked.eiland, 'Eilanden blijven dicht tot Lava is gewonnen');
    assert(pr.stars.ijs >= 1, 'ster op IJswereld');

    t.start('easy', false, 'lava');
    t.forceWin();
    pr = t.getProgress();
    assert(pr.unlocked.eiland, 'Eilanden gaan open na winst op Lava');
    assert(pr.stars.lava >= 1, 'ster op Lava (kreeg ' + pr.stars.lava + ')');
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
      var lava = document.getElementById('toren-kaart-lava');
      var eiland = document.getElementById('toren-kaart-eiland');
      function locked(el) { return el && (' ' + el.className + ' ').indexOf(' is-locked ') !== -1; }
      return {
        title: (document.querySelector('#screen-torenkaarten .prompt') || {}).textContent,
        n: document.querySelectorAll('#torenkaart-grid .toren-kaart-btn').length,
        names: [g, z, ijs, lava, eiland].map(function (el) { return el ? (el.querySelector('.toren-kaart-name') || {}).textContent : null; }),
        zandLocked: locked(z),
        ijsLocked: locked(ijs),
        lavaLocked: locked(lava),
        eilandLocked: locked(eiland),
        grasLocked: locked(g)
      };
    });
    if (maps.title.indexOf('Torenverdediging') === -1) fail('kaarttitel ontbreekt: ' + maps.title);
    else ok('kaartenscherm: ' + maps.title.trim());
    if (maps.n !== 5) fail('verwacht 5 kaartknoppen, kreeg ' + maps.n);
    else ok('5 kaartknoppen: ' + (maps.names || []).join(', '));
    if (maps.grasLocked || !maps.zandLocked || !maps.ijsLocked || !maps.lavaLocked || !maps.eilandLocked) fail('slotten kloppen niet: ' + JSON.stringify(maps));
    else ok('Grasveld open, de andere vier kaarten op slot');

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
