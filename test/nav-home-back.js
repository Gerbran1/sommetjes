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
  'tangram', 'waar', 'doolhof', 'doolhoflevel', 'verschillen', 'robotlevel', 'robot', 'memory', 'memorylevel', 'memoryplay', 'weg', 'simon', 'rij', 'cups', 'veranderd', 'tekenmenu', 'kleurkies', 'teken', 'klinkers', 'lijnlevel', 'lijn', 'geld', 'geldlevel', 'geldplay'
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
    await tap(page, '#btn-goto-tekenen');
    await expectScreen(page, 'tekenmenu', 'tekenen menu');
    await tap(page, '#btn-tekenmenu-back');
    await expectScreen(page, 'start', 'tekenen menu back');
    await tap(page, '#btn-goto-tekenen');
    await tap(page, '#btn-tekenmenu-home');
    await expectScreen(page, 'start', 'tekenen menu home');
    ok('Tekenen-menu terug/home → start');

    await fresh(page);
    await tap(page, '#btn-goto-tekenen');
    await tap(page, '[data-act="teken-vrij"]');
    await expectScreen(page, 'teken', 'vrij tekenen');
    await tap(page, '#btn-teken-back');
    await expectScreen(page, 'tekenmenu', 'vrij back');
    await tap(page, '[data-act="teken-vrij"]');
    await tap(page, '#btn-teken-home');
    await expectScreen(page, 'start', 'vrij home');
    ok('Vrij tekenen terug → menu, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-tekenen');
    await tap(page, '[data-act="teken-kleur"]');
    await expectScreen(page, 'kleurkies', 'kleurplaten kiezer');
    await tap(page, '[data-page="monstertruck"]');
    await expectScreen(page, 'teken', 'kleurplaat monstertruck');
    await tap(page, '#btn-teken-back');
    await expectScreen(page, 'kleurkies', 'kleurplaat back');
    await tap(page, '#btn-kleurkies-back');
    await expectScreen(page, 'tekenmenu', 'kiezer back');
    ok('Kleurplaten kiezer en plaat terug naar het menu');


    await fresh(page);
    await tap(page, '#btn-goto-geld');
    await expectScreen(page, 'geld', 'geld menu');
    await tap(page, '#btn-geld-back');
    await expectScreen(page, 'start', 'geld menu back');
    await tap(page, '#btn-goto-geld');
    await tap(page, '#btn-geld-home');
    await expectScreen(page, 'start', 'geld menu home');
    ok('Geld-menu terug/home → start');

    await fresh(page);
    await tap(page, '#btn-goto-geld');
    await tap(page, '#geld-grid [data-game="pot"]');
    await expectScreen(page, 'geldlevel', 'spaarpot kiezer');
    await tap(page, '#btn-geldlevel-back');
    await expectScreen(page, 'geld', 'spaarpot kiezer back');
    await tap(page, '#geld-grid [data-game="winkel"]');
    await tap(page, '#btn-geldlevel-home');
    await expectScreen(page, 'start', 'winkeltje kiezer home');
    ok('Geld-kiezer terug → Geld, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-geld');
    await tap(page, '#geld-grid [data-game="pot"]');
    await tap(page, '#geldlevel-grid [data-max="10"]');
    await expectScreen(page, 'geldplay', 'spaarpot play');
    await tap(page, '#btn-geldplay-back');
    await expectScreen(page, 'geldlevel', 'spaarpot play back');
    await tap(page, '#geldlevel-grid [data-max="10"]');
    await tap(page, '#btn-geldplay-home');
    await expectScreen(page, 'start', 'spaarpot play home');
    ok('Spaarpot terug → kiezer, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-geld');
    await tap(page, '#geld-grid [data-game="brief"]');
    await expectScreen(page, 'geldlevel', 'briefjes kiezer');
    await tap(page, '#geldlevel-grid [data-max="2000"]');
    await expectScreen(page, 'geldplay', 'briefjes play');
    await tap(page, '#btn-geldplay-back');
    await expectScreen(page, 'geldlevel', 'briefjes play back');
    ok('Winkel met briefjes terug → kiezer');


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
    await tap(page, '[data-level="minus30"]');
    await expectScreen(page, 'play', 'minus30');
    await tap(page, '#btn-play-back');
    await expectScreen(page, 'home', 'minus30 back');
    await tap(page, '[data-level="minus30"]');
    await tap(page, '#btn-home');
    await expectScreen(page, 'start', 'minus30 home');
    ok('Min tot 30 home/terug');

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

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="lijn"]');
    await expectScreen(page, 'lijnlevel', 'lijnlevel');
    await tap(page, '#btn-lijnlevel-back');
    await expectScreen(page, 'home', 'lijnlevel back');
    await tap(page, '[data-level="lijn"]');
    await tap(page, '#btn-lijnlevel-home');
    await expectScreen(page, 'start', 'lijnlevel home');
    ok('Getallenlijn-kiezer terug → Getallen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-games');
    await tap(page, '[data-level="lijn"]');
    await tap(page, '[data-max="10"]');
    await expectScreen(page, 'lijn', 'lijn 10');
    await tap(page, '#btn-lijn-back');
    await expectScreen(page, 'lijnlevel', 'lijn play back');
    await tap(page, '[data-max="10"]');
    await tap(page, '#btn-lijn-home');
    await expectScreen(page, 'start', 'lijn play home');
    ok('Getallenlijn tot 10 terug → kiezer, home → start');


    const letterModes = [
      { mode: 'zoeken', screen: 'play', back: '#btn-play-back', home: '#btn-home' },
      { mode: 'begint', screen: 'play', back: '#btn-play-back', home: '#btn-home' },
      { mode: 'trace', screen: 'trace', back: '#btn-trace-back', home: '#btn-trace-home' },
      { mode: 'klinkers', screen: 'klinkers', back: '#btn-klinkers-back', home: '#btn-klinkers-home' },
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
      { game: 'verschillen', screen: 'verschillen', back: '#btn-vers-back', home: '#btn-vers-home' }
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
    await tap(page, '[data-game="doolhof"]');
    await expectScreen(page, 'doolhoflevel', 'doolhoflevel');
    await tap(page, '#btn-doolhoflevel-back');
    await expectScreen(page, 'puzzles', 'doolhoflevel back');
    await tap(page, '[data-game="doolhof"]');
    await tap(page, '#btn-doolhoflevel-home');
    await expectScreen(page, 'start', 'doolhoflevel home');
    ok('Doolhof-kiezer terug → Puzzels, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await tap(page, '[data-game="doolhof"]');
    await tap(page, '[data-n="5"]');
    await expectScreen(page, 'doolhof', 'doolhof 5');
    await tap(page, '#btn-doolhof-back');
    await expectScreen(page, 'doolhoflevel', 'doolhof play back');
    await tap(page, '[data-n="5"]');
    await tap(page, '#btn-doolhof-home');
    await expectScreen(page, 'start', 'doolhof play home');
    ok('Doolhofje klein terug → kiezer, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await tap(page, '[data-game="robot"]');
    await expectScreen(page, 'robotlevel', 'robotlevel');
    await tap(page, '#btn-robotlevel-back');
    await expectScreen(page, 'puzzles', 'robotlevel back');
    await tap(page, '[data-game="robot"]');
    await tap(page, '#btn-robotlevel-home');
    await expectScreen(page, 'start', 'robotlevel home');
    ok('Robot-kiezer terug → Puzzels, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await tap(page, '[data-game="robot"]');
    await tap(page, '[data-kind="easy"]');
    await expectScreen(page, 'robot', 'robot easy');
    await tap(page, '#btn-robot-back');
    await expectScreen(page, 'robotlevel', 'robot play back');
    await tap(page, '[data-kind="easy"]');
    await tap(page, '#btn-robot-home');
    await expectScreen(page, 'start', 'robot play home');
    ok('De robot makkelijk terug → kiezer, home → start');

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
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="simon"]');
    await expectScreen(page, 'simon', 'simon zegt');
    await tap(page, '#btn-simon-back');
    await expectScreen(page, 'memory', 'simon back');
    await tap(page, '[data-game="simon"]');
    await tap(page, '#btn-simon-home');
    await expectScreen(page, 'start', 'simon home');
    ok('Simon zegt terug → Geheugen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="rij"]');
    await expectScreen(page, 'rij', 'onthoud de rij');
    await tap(page, '#btn-rij-back');
    await expectScreen(page, 'memory', 'rij back');
    await tap(page, '[data-game="rij"]');
    await tap(page, '#btn-rij-home');
    await expectScreen(page, 'start', 'rij home');
    ok('Onthoud de rij terug → Geheugen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="cups"]');
    await expectScreen(page, 'cups', 'waar zat het');
    await tap(page, '#btn-cups-back');
    await expectScreen(page, 'memory', 'cups back');
    await tap(page, '[data-game="cups"]');
    await tap(page, '#btn-cups-home');
    await expectScreen(page, 'start', 'cups home');
    ok('Waar zat het? terug → Geheugen, home → start');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="veranderd"]');
    await expectScreen(page, 'veranderd', 'wat is er veranderd');
    await tap(page, '#btn-veranderd-back');
    await expectScreen(page, 'memory', 'veranderd back');
    await tap(page, '[data-game="veranderd"]');
    await tap(page, '#btn-veranderd-home');
    await expectScreen(page, 'start', 'veranderd home');
    ok('Wat is er veranderd? terug → Geheugen, home → start');

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

    await fresh(page);
    await tap(page, '#btn-goto-puzzles');
    await tap(page, '[data-game="verschillen"]');
    await expectScreen(page, 'verschillen', 'verschillen start');
    for (var vi = 0; vi < 3; vi++) {
      const vKey = await page.evaluate(() => {
        var w = document.getElementById('vers-wrap');
        return w ? w.getAttribute('data-key') : '';
      });
      for (var vd = 0; vd < 5; vd++) {
        await page.evaluate((n) => {
          var hit = document.querySelector('#vers-left .vers-hit[data-diff="' + n + '"]');
          if (hit) hit.click();
        }, vd);
        await wait(80);
      }
      if (vi < 2) {
        var vNext = Date.now() + 12000;
        var vMoved = false;
        while (Date.now() < vNext) {
          vMoved = await page.evaluate((prev) => {
            var w = document.getElementById('vers-wrap');
            var k = w ? w.getAttribute('data-key') : '';
            var done = w && w.getAttribute('data-done') === '1';
            return !!(k && k !== prev && !done);
          }, vKey);
          if (vMoved) break;
          await wait(150);
        }
        if (!vMoved) throw new Error('verschillen next scene did not appear after ' + vKey);
      } else if (!(await waitReward(page, 12000))) {
        throw new Error('verschillen reward did not appear after 3');
      }
    }
    var vEnd = Date.now() + 8000;
    while (Date.now() < vEnd) {
      const vs = await visibleScreen(page);
      const vrw = await rewardVisible(page);
      if (vs === 'puzzles' && !vrw) break;
      await wait(150);
    }
    await expectScreen(page, 'puzzles', 'auto after verschillen reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after verschillen auto-return');
    ok('Ronde van 3 (Zoek de verschillen): na beloning automatisch naar Puzzels-menu');

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

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="simon"]');
    await expectScreen(page, 'simon', 'simon reward setup');
    for (var si = 0; si < 5; si++) {
      var deadlineS = Date.now() + 10000;
      var seqS = null;
      while (Date.now() < deadlineS) {
        seqS = await page.evaluate(function () {
          var board = document.getElementById('simon-board');
          if (!board || board.getAttribute('data-phase') !== 'repeat') return null;
          var s = board.getAttribute('data-seq') || '';
          return s ? s.split('-') : null;
        });
        if (seqS && seqS.length) break;
        await wait(120);
      }
      if (!seqS || !seqS.length) throw new Error('simon sequence not ready on item ' + (si + 1));
      for (var sj = 0; sj < seqS.length; sj++) {
        await tap(page, '#simon-board [data-act="simon-pad"][data-i="' + seqS[sj] + '"]');
      }
      if (si < 4) {
        var nextS = Date.now() + 8000;
        var movedS = false;
        while (Date.now() < nextS) {
          movedS = await page.evaluate(function (prev) {
            var board = document.getElementById('simon-board');
            if (!board) return false;
            var phase = board.getAttribute('data-phase');
            var seq = board.getAttribute('data-seq') || '';
            return phase === 'play' || (phase === 'repeat' && seq && seq !== prev);
          }, seqS.join('-'));
          if (movedS) break;
          await wait(150);
        }
      } else if (!(await waitReward(page, 4500))) {
        throw new Error('simon reward did not appear');
      }
    }
    var dSimon = Date.now() + 5000;
    while (Date.now() < dSimon) {
      const sSim = await visibleScreen(page);
      const rwSim = await rewardVisible(page);
      if (sSim === 'memory' && !rwSim) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after simon reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after simon auto-return');
    ok('Ronde van 5 (Simon zegt): na beloning automatisch naar Geheugen-menu');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="rij"]');
    await expectScreen(page, 'rij', 'rij reward setup');
    for (var ri = 0; ri < 5; ri++) {
      var deadlineR = Date.now() + 12000;
      var seqR = null;
      while (Date.now() < deadlineR) {
        seqR = await page.evaluate(function () {
          var row = document.getElementById('rij-row');
          if (!row || row.getAttribute('data-phase') !== 'tik') return null;
          var s = row.getAttribute('data-seq') || '';
          return s ? s.split(',') : null;
        });
        if (seqR && seqR.length) break;
        await wait(120);
      }
      if (!seqR || !seqR.length) throw new Error('rij sequence not ready on item ' + (ri + 1));
      for (var rj = 0; rj < seqR.length; rj++) {
        await tap(page, '#rij-choices [data-act="rij-pick"][data-pic="' + seqR[rj] + '"]');
      }
      if (ri < 4) {
        var nextR = Date.now() + 10000;
        var movedR = false;
        while (Date.now() < nextR) {
          movedR = await page.evaluate(function (prev) {
            var row = document.getElementById('rij-row');
            if (!row) return false;
            var phase = row.getAttribute('data-phase');
            var seq = row.getAttribute('data-seq') || '';
            return phase === 'show' || (phase === 'tik' && seq && seq !== prev);
          }, seqR.join(','));
          if (movedR) break;
          await wait(150);
        }
      } else if (!(await waitReward(page, 4500))) {
        throw new Error('rij reward did not appear');
      }
    }
    var dRij = Date.now() + 5000;
    while (Date.now() < dRij) {
      const sRij = await visibleScreen(page);
      const rwRij = await rewardVisible(page);
      if (sRij === 'memory' && !rwRij) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after rij reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after rij auto-return');
    ok('Ronde van 5 (Onthoud de rij): na beloning automatisch naar Geheugen-menu');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="cups"]');
    await expectScreen(page, 'cups', 'cups reward setup');
    for (var ci = 0; ci < 5; ci++) {
      var deadlineC = Date.now() + 16000;
      var keyC = null;
      while (Date.now() < deadlineC) {
        keyC = await page.evaluate(function () {
          var stage = document.getElementById('cups-stage');
          if (!stage || stage.getAttribute('data-phase') !== 'pick') return null;
          return stage.getAttribute('data-key') || '';
        });
        if (keyC) break;
        await wait(120);
      }
      if (!keyC) throw new Error('cups not ready on item ' + (ci + 1));
      await tap(page, '#cups-stage .cup-slot[data-has="1"] .cup-hit');
      if (ci < 4) {
        var nextC = Date.now() + 12000;
        var movedC = false;
        while (Date.now() < nextC) {
          movedC = await page.evaluate(function (prev) {
            var stage = document.getElementById('cups-stage');
            if (!stage) return false;
            var phase = stage.getAttribute('data-phase');
            var key = stage.getAttribute('data-key') || '';
            return phase === 'look' || phase === 'swap' || (phase === 'pick' && key && key !== prev);
          }, keyC);
          if (movedC) break;
          await wait(150);
        }
      } else if (!(await waitReward(page, 4500))) {
        throw new Error('cups reward did not appear');
      }
    }
    var dCups = Date.now() + 5000;
    while (Date.now() < dCups) {
      const sCups = await visibleScreen(page);
      const rwCups = await rewardVisible(page);
      if (sCups === 'memory' && !rwCups) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after cups reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after cups auto-return');
    ok('Ronde van 5 (Waar zat het?): na beloning automatisch naar Geheugen-menu');

    await fresh(page);
    await tap(page, '#btn-goto-memory');
    await tap(page, '[data-game="veranderd"]');
    await expectScreen(page, 'veranderd', 'veranderd reward setup');
    for (var vi = 0; vi < 5; vi++) {
      var deadlineV = Date.now() + 10000;
      var keyV = null;
      while (Date.now() < deadlineV) {
        keyV = await page.evaluate(function () {
          var board = document.getElementById('veranderd-board');
          if (!board || board.getAttribute('data-phase') !== 'ask') return null;
          return board.getAttribute('data-key') || '';
        });
        if (keyV) break;
        await wait(120);
      }
      if (!keyV) throw new Error('veranderd not ready on item ' + (vi + 1));
      await tap(page, '#veranderd-board [data-ok="1"]');
      if (vi < 4) {
        var nextV = Date.now() + 10000;
        var movedV = false;
        while (Date.now() < nextV) {
          movedV = await page.evaluate(function (prev) {
            var board = document.getElementById('veranderd-board');
            if (!board) return false;
            var phase = board.getAttribute('data-phase');
            var key = board.getAttribute('data-key') || '';
            return phase === 'look' || (phase === 'ask' && key && key !== prev);
          }, keyV);
          if (movedV) break;
          await wait(150);
        }
      } else if (!(await waitReward(page, 4500))) {
        throw new Error('veranderd reward did not appear');
      }
    }
    var dVer = Date.now() + 5000;
    while (Date.now() < dVer) {
      const sVer = await visibleScreen(page);
      const rwVer = await rewardVisible(page);
      if (sVer === 'memory' && !rwVer) break;
      await wait(150);
    }
    await expectScreen(page, 'memory', 'auto after veranderd reward');
    if (await rewardVisible(page)) throw new Error('reward still visible after veranderd auto-return');
    ok('Ronde van 5 (Wat is er veranderd?): na beloning automatisch naar Geheugen-menu');

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
