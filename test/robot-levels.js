/**
 * Procedural robot levels must be solvable, of sensible length,
 * and match their difficulty (easy/mid/hard).
 *
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/robot-levels.js
 */
const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  const ready = await page.evaluate(() => !!(window.__robotTest && window.__robotTest.make));
  if (!ready) throw new Error('window.__robotTest hook missing');

  function ok(msg) { console.log('OK  ' + msg); }
  var failed = 0;
  function fail(msg) { failed += 1; console.log('FAIL  ' + msg); }

  const specs = [
    { kind: 'easy', n: 40, expectN: 4, minLen: 2, maxLen: 5, minTurns: 0, maxTurns: 1, minWalls: 0, maxWalls: 0 },
    { kind: 'mid', n: 40, expectN: 5, minLen: 4, maxLen: 8, minTurns: 2, maxTurns: 99, minWalls: 3, maxWalls: 99 },
    { kind: 'hard', n: 40, expectN: 6, minLen: 6, maxLen: 12, minTurns: 3, maxTurns: 99, minWalls: 8, maxWalls: 99 }
  ];

  for (const spec of specs) {
    const result = await page.evaluate((spec) => {
      var T = window.__robotTest;
      var out = { ok: [], bad: [], keys: {} };
      var i, lvl, sol, sim, wallsN, key, turns;
      for (i = 0; i < spec.n; i++) {
        lvl = T.make(spec.kind);
        if (!lvl) { out.bad.push('#' + i + ' make returned null'); continue; }
        key = lvl.key;
        out.keys[key] = (out.keys[key] || 0) + 1;
        if (lvl.n !== spec.expectN) out.bad.push('#' + i + ' n=' + lvl.n);
        sol = T.shortest(lvl.n, lvl.walls, lvl.sr, lvl.sc, lvl.gr, lvl.gc);
        if (!sol) { out.bad.push('#' + i + ' unsolvable ' + key); continue; }
        if (sol.len < spec.minLen || sol.len > spec.maxLen) {
          out.bad.push('#' + i + ' len=' + sol.len + ' key=' + key);
        }
        turns = sol.turns;
        if (turns < spec.minTurns || turns > spec.maxTurns) {
          out.bad.push('#' + i + ' turns=' + turns + ' key=' + key);
        }
        wallsN = T.countWalls(lvl.walls, lvl.n);
        if (wallsN < spec.minWalls || wallsN > spec.maxWalls) {
          out.bad.push('#' + i + ' walls=' + wallsN + ' key=' + key);
        }
        if (!lvl.sol || !lvl.sol.length) out.bad.push('#' + i + ' missing sol');
        else {
          sim = T.simulate(lvl, lvl.sol);
          if (!sim || !sim.ok || !sim.atGoal) out.bad.push('#' + i + ' sol does not reach goal');
        }
        // stored sol should be a shortest path
        if (lvl.sol && sol && lvl.sol.length !== sol.len) {
          out.bad.push('#' + i + ' stored sol len ' + lvl.sol.length + ' != shortest ' + sol.len);
        }
        out.ok.push({ len: sol ? sol.len : 0, turns: turns, walls: wallsN });
      }
      return out;
    }, spec);
    if (result.bad.length) {
      fail(spec.kind + ': ' + result.bad.slice(0, 8).join(' ; ') + (result.bad.length > 8 ? ' ...' : '') + ' (' + result.bad.length + ' issues)');
    } else {
      var lens = result.ok.map(function (x) { return x.len; });
      var turns = result.ok.map(function (x) { return x.turns; });
      var walls = result.ok.map(function (x) { return x.walls; });
      function mid(a) { return a.slice().sort(function (x,y){return x-y;})[Math.floor(a.length/2)]; }
      var nUnique = Object.keys(result.keys).length;
      if (nUnique < 10) fail(spec.kind + ' unique pool too small: ' + nUnique);
      ok(spec.kind + ' ' + result.ok.length + '/' + spec.n +
        ' unique ' + nUnique +
        ' len ' + Math.min.apply(null, lens) + '-' + Math.max.apply(null, lens) +
        ' (med ' + mid(lens) + '), turns ' + Math.min.apply(null, turns) + '-' + Math.max.apply(null, turns) +
        ' walls med ' + mid(walls));
    }
  }

  await browser.close();
  if (failed) {
    console.log('ROBOT LEVEL CHECKS FAILED');
    process.exit(1);
  }
  console.log('ALL ROBOT LEVEL CHECKS OK');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
