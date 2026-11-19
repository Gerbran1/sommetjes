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
  await browser.close();
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
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
