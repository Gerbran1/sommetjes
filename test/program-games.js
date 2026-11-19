'use strict';
/* ES5-friendly generator + solvability checks for Programmeren games. */
const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise(function (r) { setTimeout(r, ms); });

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.goto(APP, { waitUntil: 'networkidle0' });
  const result = await page.evaluate(function () {
    var T = window.__programTest;
    if (!T) return { error: 'no __programTest' };
    var kinds = ['easy', 'mid', 'hard'];
    var failed = [];
    var summary = {};
    function assert(cond, msg) {
      if (!cond) failed.push(msg);
    }
    var k, i, kind, level, tiles, exp, res, fixes, keys, ok, diffs, j;
    for (k = 0; k < kinds.length; k++) {
      kind = kinds[k];
      keys = {};
      ok = 0;
      for (i = 0; i < 40; i++) {
        level = T.makeHerhaal(kind);
        assert(!!level, 'herhaal missing ' + kind);
        if (!level) continue;
        tiles = T.compress(level.sol);
        exp = T.expand(tiles);
        res = T.simulate(level, level.sol);
        assert(res.ok, 'herhaal not solvable ' + kind + ' ' + (level.sol && level.sol.join(',')));
        assert(level.sol.length > level.maxSlots, 'herhaal no-repeat-needed ' + kind + ' len=' + level.sol.length + ' max=' + level.maxSlots);
        assert(tiles.length <= level.maxSlots, 'herhaal compress too long ' + kind);
        assert(exp.join(',') === level.sol.join(','), 'herhaal expand mismatch ' + kind);
        keys[level.key] = 1;
        ok += 1;
      }
      summary['herhaal-' + kind] = { ok: ok, unique: Object.keys(keys).length };
      assert(Object.keys(keys).length >= 8, 'herhaal few keys ' + kind);
    }
    for (k = 0; k < kinds.length; k++) {
      kind = kinds[k];
      keys = {};
      ok = 0;
      for (i = 0; i < 40; i++) {
        level = T.makeVolg(kind);
        assert(!!level && level.given && level.given.length, 'volg missing ' + kind);
        if (!level) continue;
        res = T.simulate(level, level.given);
        assert(!!res.ok && res.r === level.gr && res.c === level.gc, 'volg end mismatch ' + kind);
        keys[level.key] = 1;
        ok += 1;
      }
      summary['volg-' + kind] = { ok: ok, unique: Object.keys(keys).length };
      assert(Object.keys(keys).length >= 8, 'volg few keys ' + kind);
    }
    for (k = 0; k < kinds.length; k++) {
      kind = kinds[k];
      keys = {};
      ok = 0;
      for (i = 0; i < 40; i++) {
        level = T.makeFout(kind);
        assert(!!level && level.given, 'fout missing ' + kind);
        if (!level) continue;
        res = T.simulate(level, level.given);
        assert(!res.ok, 'fout broken still works ' + kind);
        res = T.simulate(level, level.sol);
        assert(!!res.ok, 'fout sol fails ' + kind);
        fixes = T.fixes(level, level.given);
        assert(fixes.length === 1, 'fout not unique ' + kind + ' fixes=' + fixes.length);
        if (fixes.length === 1) {
          assert(fixes[0].i === level.wrongI && fixes[0].dir === level.correctDir, 'fout fix mismatch ' + kind);
        }
        diffs = 0;
        for (j = 0; j < level.sol.length; j++) if (level.sol[j] !== level.given[j]) diffs += 1;
        assert(diffs === 1, 'fout not exactly one wrong ' + kind + ' diffs=' + diffs);
        keys[level.key] = 1;
        ok += 1;
      }
      summary['fout-' + kind] = { ok: ok, unique: Object.keys(keys).length };
      assert(Object.keys(keys).length >= 8, 'fout few keys ' + kind);
    }
    return { failed: failed, summary: summary };
  });
  if (result.error) {
    console.error('ERROR', result.error);
    process.exit(1);
  }
  var name;
  for (name in result.summary) {
    console.log('OK  ' + name + '  generated ' + result.summary[name].ok + ', unique keys ' + result.summary[name].unique);
  }
  if (result.failed && result.failed.length) {
    result.failed.forEach(function (m) { console.log('FAIL ' + m); });
    console.log('FAILED', result.failed.length);
    process.exit(1);
  }
  console.log('ALL PROGRAM GEN CHECKS OK (360)');

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function openVolgEasy(page) {
    await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
    await page.goto(APP, { waitUntil: 'networkidle0' });
    await wait(200);
    await page.click('#btn-goto-program');
    await wait(250);
    await page.click('#program-grid [data-game="volg"]');
    await wait(250);
    await page.click('[data-kind="easy"]');
    await wait(400);
  }

  function volgSnapshot() {
    return page.evaluate(function () {
      var S = window.__programTest.state;
      var wrap = document.getElementById('robot-wrap');
      var sprite = document.getElementById('robot-sprite');
      return {
        sr: S.sr, sc: S.sc, gr: S.gr, gc: S.gc, r: S.r, c: S.c, n: S.n,
        key: S.key, misses: S.volgMisses || 0, reveal: !!S.volgReveal, showEnd: !!S.showEnd,
        busy: !!(wrap && wrap.getAttribute('data-busy') === '1'),
        done: !!(wrap && wrap.getAttribute('data-done') === '1'),
        dataMisses: wrap ? wrap.getAttribute('data-misses') : '',
        dataReveal: wrap ? wrap.getAttribute('data-reveal') : '',
        wrongN: document.querySelectorAll('.robot-cell.is-wrong').length,
        endN: document.querySelectorAll('.robot-cell.is-end').length,
        stars: (document.getElementById('robot-stars') || {}).textContent || '0',
        atStart: S.r === S.sr && S.c === S.sc
      };
    });
  }

  function pickWrong(info) {
    var r, c;
    for (r = 0; r < info.n; r++) {
      for (c = 0; c < info.n; c++) {
        if ((r !== info.gr || c !== info.gc) && (r !== info.sr || c !== info.sc)) {
          return { r: r, c: c };
        }
      }
    }
    throw new Error('no wrong cell available');
  }

  await openVolgEasy(page);
  var info = await volgSnapshot();
  var wrong = pickWrong(info);
  var key0 = info.key;
  var stars0 = info.stars;
  await page.click('.robot-cell[data-r="' + wrong.r + '"][data-c="' + wrong.c + '"]');
  await wait(150);
  var miss1 = await volgSnapshot();
  if (miss1.misses !== 1) throw new Error('first miss should set misses=1, got ' + miss1.misses);
  if (!miss1.atStart) throw new Error('first miss moved the robot');
  if (miss1.reveal || miss1.dataReveal === '1') throw new Error('first miss revealed the walk');
  if (miss1.showEnd || miss1.endN) throw new Error('first miss showed the end cell');
  if (miss1.wrongN < 1) throw new Error('first miss did not mark the tapped cell red');
  if (miss1.done) throw new Error('first miss marked the puzzle done');
  if (miss1.key !== key0) throw new Error('first miss advanced the puzzle');
  await page.screenshot({ path: '/workspace/rekenapp/screenshots/50-volg-fix.png', type: 'png' });
  console.log('OK  volg first miss: no walk, no green end, red cell, screenshot saved');

  await wait(900);
  var after1 = await volgSnapshot();
  if (!after1.atStart) throw new Error('robot moved after first-miss feedback');
  if (after1.showEnd || after1.endN) throw new Error('end cell visible after first-miss feedback');
  if (after1.busy) throw new Error('still locked after first-miss feedback');
  if (after1.misses !== 1) throw new Error('misses should stay 1 after feedback, got ' + after1.misses);
  if (after1.key !== key0) throw new Error('puzzle changed after first-miss feedback');

  await page.click('.robot-cell[data-r="' + wrong.r + '"][data-c="' + wrong.c + '"]');
  await wait(250);
  var miss2 = await volgSnapshot();
  if (miss2.misses < 2) throw new Error('second miss should set misses>=2, got ' + miss2.misses);
  if (miss2.dataReveal !== '1' && !miss2.reveal) throw new Error('second miss should start the reveal walk');
  if (miss2.endN) throw new Error('end cell should not be pre-highlighted at start of reveal walk');
  if (miss2.key !== key0) throw new Error('second miss advanced before the walk finished');
  console.log('OK  volg second miss: started reveal walk, answer not pre-drawn');

  var started = Date.now();
  var next = null;
  while (Date.now() - started < 14000) {
    next = await volgSnapshot();
    if (next.key && next.key !== key0 && !next.busy) break;
    await wait(200);
  }
  if (!next || next.key === key0) throw new Error('second miss did not advance to the next puzzle');
  if (next.stars !== stars0) throw new Error('unsolved volg puzzle awarded a star (' + stars0 + ' -> ' + next.stars + ')');
  if (next.done) throw new Error('next puzzle already marked done');
  if (next.misses !== 0) throw new Error('misses should reset on the next puzzle');
  console.log('OK  volg second miss: showed the walk and advanced unsolved (stars unchanged)');

  var goal = { r: next.gr, c: next.gc };
  await page.click('.robot-cell[data-r="' + goal.r + '"][data-c="' + goal.c + '"]');
  started = Date.now();
  var won = null;
  while (Date.now() - started < 14000) {
    won = await volgSnapshot();
    if (won.done) break;
    await wait(200);
  }
  if (!won || !won.done) throw new Error('correct volg tap did not finish with praise/done');
  if (!(parseInt(won.stars, 10) > parseInt(stars0, 10))) throw new Error('correct volg tap did not award a star');
  console.log('OK  volg correct tap: robot walks and awards a star');

  await browser.close();
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
