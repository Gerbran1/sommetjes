/**
 * Headless navigation test for Sommetjes.
 * Home always goes to the start screen. Back goes one level up.
 * After a reward (round of 5), the app returns to that game's menu.
 *
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/nav-home-back.js
 * (needs puppeteer-core and Chrome)
 */
const puppeteer = require('puppeteer-core');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const SCREENS = [
  'start', 'home', 'picker', 'play', 'letters', 'trace', 'names', 'nameplay',
  'puzzles', 'puzzlelevel', 'puzzle', 'vormen', 'spiegel', 'nateken',
  'tangram', 'waar', 'doolhof', 'memory', 'memorylevel', 'memoryplay', 'weg'
];

async function visibleScreen(page) {
  return page.evaluate((ids) => {
    var i, el;
    for (i = 0; i < ids.length; i++) {
      el = document.getElementById('screen-' + ids[i]);
      if (el && el.className.indexOf('is-hidden') === -1) return ids[i];
    }
    return null;
  }, SCREENS);
}

async function rewardVisible(page) {
  return page.evaluate(() => {
    var el = document.getElementById('overlay-reward');
    return !!(el && el.className.indexOf('is-hidden') === -1);
  });
}

async function tap(page, sel) {
  await page.waitForSelector(sel, { timeout: 8000 });
  const handle = await page.$(sel);
  if (!handle) throw new Error('missing ' + sel);
  await handle.click();
  await wait(280);
}

async function fresh(page) {
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      localStorage.setItem('sommetjes-sound', '0');
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(200);
  const s = await visibleScreen(page);
  if (s !== 'start') throw new Error('expected start after fresh, got ' + s);
}

async function expectScreen(page, want, ctx) {
  const got = await visibleScreen(page);
  if (got !== want) {
    throw new Error((ctx || '') + ' expected screen "' + want + '", got "' + got + '"');
  }
}

async function openSlidePicker(page) {
  await page.evaluate(() => {
    var el = document.querySelector('[data-game="slide"]');
    if (el) el.click();
  });
  await wait(300);
}

async function waitReward(page, ms) {
  var deadline = Date.now() + (ms || 4500);
  while (Date.now() < deadline) {
    if (await rewardVisible(page)) return true;
    await wait(150);
  }
  return false;
}

async function clickCorrectAnswer(page) {
  await page.waitForSelector('#answers [data-ok="1"]', { timeout: 8000 });
  await page.evaluate(() => {
    var okb = document.querySelector('#answers [data-ok="1"]');
    if (okb) okb.click();
  });
}

async function waitNextQuestion(page) {
  var deadline = Date.now() + 4500;
  await wait(400);
  while (Date.now() < deadline) {
    const ready = await page.evaluate(() => {
      var b = document.querySelector('#answers [data-ok="1"]');
      return !!(b && b.className.indexOf('is-correct') === -1);
    });
    if (ready) return;
    await wait(150);
  }
}

async function solveSpiegel(page) {
  await page.waitForSelector('button.spiegel-cell', { timeout: 8000 });
  await page.evaluate(() => {
    var buttons = document.querySelectorAll('button.spiegel-cell');
    var left = document.querySelectorAll('.spiegel-cell.locked');
    var maxR = 0, maxC = 0, i, r, c, should, btn, isOn, el;
    if (!buttons.length || !left.length) return;
    for (i = 0; i < buttons.length; i++) {
      r = parseInt(buttons[i].getAttribute('data-r'), 10);
      c = parseInt(buttons[i].getAttribute('data-c'), 10);
      if (r > maxR) maxR = r;
      if (c > maxC) maxC = c;
    }
    var rows = maxR + 1, cols = maxC + 1;
    for (r = 0; r < rows; r++) {
      for (c = 0; c < cols; c++) {
        el = left[r * cols + (cols - 1 - c)];
        should = el && (' ' + el.className + ' ').indexOf(' on ') !== -1;
        btn = document.querySelector('button.spiegel-cell[data-r="' + r + '"][data-c="' + c + '"]');
        isOn = btn && (' ' + btn.className + ' ').indexOf(' on ') !== -1;
        if (should !== !!isOn && btn) btn.click();
      }
    }
  });
}

async function waitSpiegelNext(page) {
  var deadline = Date.now() + 4500;
  await wait(400);
  while (Date.now() < deadline) {
    const emptyRight = await page.evaluate(() => document.querySelectorAll('button.spiegel-cell.on').length === 0);
    const rew = await rewardVisible(page);
    if (emptyRight && !rew) return;
    await wait(150);
  }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  const results = [];
  function ok(name) { results.push('OK  ' + name); console.log('OK  ' + name); }

  try {
    await fresh(page);
    await tap(page, '#btn-goto-games');
    await expectScreen(page, 'home', 'goto getallen');
    await tap(page, '#btn-games-home');
    await expectScreen(page, 'start', 'getallen home');
    ok('Getallen menu home → start');

    await fresh(page);
    await tap(page, '#btn-goto-letters');
    await expectScreen(page, 'letters', 'goto letters');
    await tap(page, '#btn-letters-home');
    await expectScreen(page, 'start', 'letters home');
    ok('Letters menu home → start');

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await expectScreen(page, 'puzzles', 'goto puzzels');
    await tap(page, '#btn-puzzles-home');
    await expectScreen(page, 'start', 'puzzels home');
    ok('Puzzels menu home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await expectScreen(page, 'memory', 'goto geheugen');
    await tap(page, '#btn-memory-home');
    await expectScreen(page, 'start', 'geheugen home');
    ok('Geheugen menu home → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="count"]');
    await expectScreen(page, 'play', 'count');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'home', 'count back');
    ok('Tellen terug → Getallen');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="count"]');
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'count home');
    ok('Tellen home → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="plus5"]');
    await expectScreen(page, 'play', 'plus5');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'home', 'plus5 back');
    await tap(page, '[data-level="plus10"]');
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'plus10 home');
    ok('Plus home/terug');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="plus30"]');
    await expectScreen(page, 'play', 'plus30');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'home', 'plus30 back');
    await tap(page, '[data-level="plus30"]');
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'plus30 home');
    ok('Plus tot 30 home/terug');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="minus"]');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'home', 'minus back');
    ok('Min terug → Getallen');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="tables"]');
    await expectScreen(page, 'picker', 'tafels');
    await tap(page, '#btn-picker-back');
    await expectScreen(page, 'home', 'picker back');
    ok('Tafelkiezer terug → Getallen');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="tables"]');
    await tap(page, '#btn-picker-home');
    await expectScreen(page, 'start', 'picker home');
    ok('Tafelkiezer home → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="tables"]');
    await tap(page, '[data-table="2"]');
    await expectScreen(page, 'play', 'tafel 2');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'picker', 'tafel play back');
    await tap(page, '[data-table="2"]');
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'tafel play home');
    ok('Tafel-som terug → kiezer, home → start');

    const letterModes = [
      { mode: 'zoeken', screen: 'play', back: '#btn-play-back', home: '#btn-home' },
      { mode: 'begint', screen: 'play', back: '#btn-play-back', home: '#btn-home' },
      { mode: 'trace', screen: 'trace', back: '#btn-trace-back', home: '#btn-trace-home' },
      { mode: 'naam', screen: 'names', back: '#btn-names-back', home: '#btn-names-home' }
    ];
    for (const m of letterModes) {
      await fresh(page);
      await tap(page, '#btn-goto-letters');
      await tap(page, '[data-mode="' + m.mode + '"]');
      await expectScreen(page, m.screen, m.mode);
      await tap(page, m.back);
      await expectScreen(page, 'letters', m.mode + ' back');
      await tap(page, '[data-mode="' + m.mode + '"]');
      await tap(page, m.home);
      await expectScreen(page, 'start', m.mode + ' home');
      ok('Letters ' + m.mode + ' terug → menu, home → start');
    }

    await fresh(page);
    await tap(page, '#btn-goto-letters');
    await tap(page, '[data-mode="naam"]');
    await tap(page, '[data-act="pick-name"][data-name="Jasper"]');
    await expectScreen(page, 'nameplay', 'nameplay');
    await tap(page, '#btn-nameplay-back');
    await expectScreen(page, 'letters', 'nameplay back');
    await tap(page, '[data-mode="naam"]');
    // pick-name does not always persist as the start-screen player
    var afterNaam = await visibleScreen(page);
    if (afterNaam === 'names') {
      await tap(page, '[data-act="pick-name"][data-name="Jasper"]');
    }
    await expectScreen(page, 'nameplay', 'naam again');
    await tap(page, '#btn-nameplay-home');
    await expectScreen(page, 'start', 'nameplay home');
    ok('Letters naam-spel terug → menu, home → start');

    const puzzles = [
      { game: 'vormen', screen: 'vormen', back: '#btn-vormen-back', home: '#btn-vormen-home' },
      { game: 'spiegel', screen: 'spiegel', back: '#btn-spiegel-back', home: '#btn-spiegel-home' },
      { game: 'nateken', screen: 'nateken', back: '#btn-nateken-back', home: '#btn-nateken-home' },
      { game: 'tangram', screen: 'tangram', back: '#btn-tangram-back', home: '#btn-tangram-home' },
      { game: 'waar', screen: 'waar', back: '#btn-waar-back', home: '#btn-waar-home' },
      { game: 'doolhof', screen: 'doolhof', back: '#btn-doolhof-back', home: '#btn-doolhof-home' }
    ];
    for (const g of puzzles) {
      await fresh(page);
      await tap(page, '#btn-goto-puzzles');
      await tap(page, '[data-game="' + g.game + '"]');
      await expectScreen(page, g.screen, g.game);
      await tap(page, g.back);
      await expectScreen(page, 'puzzles', g.game + ' back');
      await tap(page, '[data-game="' + g.game + '"]');
      await tap(page, g.home);
      await expectScreen(page, 'start', g.game + ' home');
      ok('Puzzel ' + g.game + ' terug → menu, home → start');
    }

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await openSlidePicker(page);
    await expectScreen(page, 'puzzlelevel', 'schuif level');
    await tap(page, '#btn-puzzlelevel-back');
    await expectScreen(page, 'puzzles', 'schuif level back');
    await openSlidePicker(page);
    await tap(page, '#btn-puzzlelevel-home');
    await expectScreen(page, 'start', 'schuif level home');
    ok('Schuifpuzzel-kiezer terug → Puzzels, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await openSlidePicker(page);
    await tap(page, '[data-size="2"]');
    await expectScreen(page, 'puzzle', 'schuif 2x2');
    await tap(page, '#btn-puzzle-back');
    await expectScreen(page, 'puzzlelevel', 'schuif play back');
    await tap(page, '[data-size="2"]');
    await tap(page, '#btn-puzzle-home');
    await expectScreen(page, 'start', 'schuif play home');
    ok('Schuifpuzzel terug → kiezer, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="memory"]');
    await expectScreen(page, 'memorylevel', 'memory level');
    await tap(page, '#btn-memorylevel-back');
    await expectScreen(page, 'memory', 'memory level back');
    await tap(page, '[data-game="memory"]');
    await tap(page, '#btn-memorylevel-home');
    await expectScreen(page, 'start', 'memory level home');
    ok('Memory-kiezer terug → Geheugen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="memory"]');
    await tap(page, '[data-size="6"]');
    await expectScreen(page, 'memoryplay', 'memory 6');
    await tap(page, '#btn-memoryplay-back');
    await expectScreen(page, 'memorylevel', 'memory play back');
    await tap(page, '[data-size="6"]');
    await tap(page, '#btn-memoryplay-home');
    await expectScreen(page, 'start', 'memory play home');
    ok('Memory terug → kiezer, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="weg"]');
    await expectScreen(page, 'weg', 'wat is er weg');
    await tap(page, '#btn-weg-back');
    await expectScreen(page, 'memory', 'weg back');
    await tap(page, '[data-game="weg"]');
    await tap(page, '#btn-weg-home');
    await expectScreen(page, 'start', 'weg home');
    ok('Wat is er weg terug → Geheugen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="plus5"]');
    await wait(400);
    await page.evaluate(() => {
      var okb = document.querySelector('#answers [data-ok="1"]');
      if (okb) okb.click();
    });
    await wait(200);
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'home during praise wait');
    ok('Home tijdens lofzang-wacht → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="count"]');
    await expectScreen(page, 'play', 'count for reward');
    for (var i = 0; i < 5; i++) {
      await clickCorrectAnswer(page);
      if (i < 4) await waitNextQuestion(page);
      else if (!(await waitReward(page, 4500))) throw new Error('reward did not appear after 5 correct');
    }
    const stillPlay = await visibleScreen(page);
    if (stillPlay !== 'play') throw new Error('reward should appear on play, got ' + stillPlay);
    await tap(page, '#btn-verder');
    await expectScreen(page, 'home', 'reward verder');
    if (await rewardVisible(page)) throw new Error('reward still visible after verder');
    ok('Ronde van 5 (Tellen): tik op beloning → Getallen-menu');

    // Auto-return after reward wait, no tap
    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await tap(page, '[data-game="spiegel"]');
    for (var j = 0; j < 5; j++) {
      await solveSpiegel(page);
      if (j < 4) await waitSpiegelNext(page);
      else if (!(await waitReward(page, 4500))) throw new Error('spiegel reward did not appear');
    }
    var d4 = Date.now() + 5000;
    while (Date.now() < d4) {
      const s = await visibleScreen(page);
      const rw = await rewardVisible(page);
      if (s === 'puzzles' && !rw) break;
      await wait(150);
    }
    await expectScreen(page, 'puzzles', 'auto after reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after auto-return');
    ok('Ronde van 5 (Spiegelen): na beloning automatisch naar Puzzels-menu');

    // Tafels: after reward, back to the table picker
    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="tables"]');
    await tap(page, '[data-table="1"]');
    for (var k = 0; k < 5; k++) {
      await clickCorrectAnswer(page);
      if (k < 4) await waitNextQuestion(page);
      else if (!(await waitReward(page, 4500))) throw new Error('tafel reward did not appear');
    }
    await tap(page, '#btn-verder');
    await expectScreen(page, 'picker', 'tafel reward verder');
    ok('Ronde van 5 (Tafels): tik op beloning → tafelkiezer');

    // Memory: one completed board is a reward, then back to Geheugen menu
    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="memory"]');
    await tap(page, '[data-size="6"]');
    await expectScreen(page, 'memoryplay', 'memory reward setup');
    await wait(200);
    var pairs = await page.evaluate(function () {
      var board = document.getElementById('memory-board');
      var btns = board ? board.getElementsByTagName('button') : [];
      var map = {}, keys = [], i, html, front, out = [], k;
      for (i = 0; i < btns.length; i++) {
        front = btns[i].getElementsByClassName('mem-front')[0];
        html = front ? front.innerHTML : String(i);
        if (!map[html]) {
          map[html] = [];
          keys.push(html);
        }
        map[html].push(i);
      }
      for (k = 0; k < keys.length; k++) out.push(map[keys[k]]);
      return out;
    });
    if (!pairs.length) throw new Error('memory board has no pairs');
    for (var mp = 0; mp < pairs.length; mp++) {
      await tap(page, '[data-act="memory-card"][data-i="' + pairs[mp][0] + '"]');
      await wait(120);
      await tap(page, '[data-act="memory-card"][data-i="' + pairs[mp][1] + '"]');
      await wait(220);
    }
    if (!(await waitReward(page, 4500))) throw new Error('memory reward did not appear');
    var dMem = Date.now() + 5000;
    while (Date.now() < dMem) {
      const sMem = await visibleScreen(page);
      const rwMem = await rewardVisible(page);
      if (sMem === 'memory' && !rwMem) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after memory reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after memory auto-return');
    ok('Memory-bord voltooid: na beloning automatisch naar Geheugen-menu');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="weg"]');
    await expectScreen(page, 'weg', 'weg reward setup');
    for (var wi = 0; wi < 5; wi++) {
      var deadlineW = Date.now() + 6000;
      var readyW = false;
      while (Date.now() < deadlineW) {
        readyW = await page.evaluate(function () {
          var b = document.querySelector('#weg-answers [data-ok="1"]');
          return !!(b && b.className.indexOf('is-correct') === -1);
        });
        if (readyW) break;
        await wait(120);
      }
      if (!readyW) throw new Error('weg answers not ready on item ' + (wi + 1));
      await tap(page, '#weg-answers [data-ok="1"]');
      if (wi < 4) {
        var nextW = Date.now() + 7000;
        var moved = false;
        while (Date.now() < nextW) {
          moved = await page.evaluate(function () {
            var b = document.querySelector('#weg-answers [data-ok="1"]');
            var board = document.getElementById('weg-board');
            var looking = board && board.querySelectorAll('.weg-slot').length === 4 && !b;
            return looking || (b && b.className.indexOf('is-correct') === -1);
          });
          if (moved) break;
          await wait(150);
        }
      } else if (!(await waitReward(page, 4500))) {
        throw new Error('weg reward did not appear');
      }
    }
    var dWeg = Date.now() + 5000;
    while (Date.now() < dWeg) {
      const sWeg = await visibleScreen(page);
      const rwWeg = await rewardVisible(page);
      if (sWeg === 'memory' && !rwWeg) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after weg reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after weg auto-return');
    ok('Ronde van 5 (Wat is er weg?): na beloning automatisch naar Geheugen-menu');

    console.log('\nALL NAV CHECKS OK (' + results.length + ')');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('\nTEST FAILED');
    console.error(results.join('\n'));
    console.error(e && e.stack ? e.stack : e);
    try { await page.screenshot({ path: '/workspace/rekenapp/screenshots/nav-test-fail.png' }); } catch (e2) {}
    await browser.close();
    process.exit(1);
  }
})();
