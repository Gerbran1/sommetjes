/**
 * After each correct answer, the next item in a round of 5 must be new
 * (unless the pool is smaller than 5). History of the last 5 is avoided
 * on the next round when the pool is large enough.
 *
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/no-repeat-round.js
 */
const puppeteer = require('puppeteer-core');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fresh(page) {
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch (e) {}
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(200);
}

async function clickCorrect(page) {
  await page.waitForSelector('#answers [data-ok="1"]', { timeout: 8000 });
  await page.evaluate(() => {
    var b = document.querySelector('#answers [data-ok="1"]');
    if (b) b.click();
  });
}

async function waitNextOrReward(page) {
  var deadline = Date.now() + 4500;
  await wait(400);
  while (Date.now() < deadline) {
    const st = await page.evaluate(() => {
      var rew = document.getElementById('overlay-reward');
      var rewardOn = rew && rew.className.indexOf('is-hidden') === -1;
      var b = document.querySelector('#answers [data-ok="1"]');
      var ready = b && b.className.indexOf('is-correct') === -1;
      var prompt = (document.getElementById('prompt') || {}).innerText || '';
      return { rewardOn: rewardOn, ready: ready, prompt: prompt };
    });
    if (st.rewardOn || st.ready) return st;
    await wait(120);
  }
  throw new Error('timeout waiting for next question or reward');
}

async function readPlayKey(page, kind) {
  return page.evaluate((kind) => {
    var prompt = (document.getElementById('prompt') || {}).innerText || '';
    var ok = document.querySelector('#answers [data-ok="1"]');
    var ans = ok ? ok.getAttribute('data-value') : '';
    if (kind === 'count') return ans;
    if (kind === 'plus') {
      var m = prompt.match(/(\d+)\s*\+\s*(\d+)/);
      return m ? m[1] + '+' + m[2] : prompt;
    }
    if (kind === 'minus') {
      var m2 = prompt.match(/(\d+)\s*[−\-–]\s*(\d+)/);
      return m2 ? m2[1] + '-' + m2[2] : prompt;
    }
    if (kind === 'tables') {
      var m3 = prompt.match(/(\d+)\s*[×x]\s*(\d+)/);
      return m3 ? m3[1] + 'x' + m3[2] : prompt;
    }
    if (kind === 'zoeken') return ans;
    if (kind === 'begint') return ans;
    return prompt + '|' + ans;
  }, kind);
}

async function playRound(page, kind, n) {
  var keys = [];
  var i, key, st;
  for (i = 0; i < n; i++) {
    key = await readPlayKey(page, kind);
    keys.push(key);
    await clickCorrect(page);
    if (i < n - 1) {
      st = await waitNextOrReward(page);
      if (st.rewardOn) throw new Error(kind + ' reward too early after ' + keys.join(','));
    } else {
      st = await waitNextOrReward(page);
      if (!st.rewardOn) throw new Error(kind + ' expected reward after 5, keys=' + keys.join(','));
    }
  }
  return keys;
}

function assertUnique(keys, label) {
  var i, seen = {};
  for (i = 0; i < keys.length; i++) {
    if (seen[keys[i]]) throw new Error(label + ' duplicate in round: ' + keys[i] + ' in ' + keys.join(', '));
    seen[keys[i]] = 1;
  }
}

function intersection(a, b) {
  var i, set = {}, out = [];
  for (i = 0; i < a.length; i++) set[a[i]] = 1;
  for (i = 0; i < b.length; i++) if (set[b[i]]) out.push(b[i]);
  return out;
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
    // Tellen: 10 numbers, two rounds of 5 should be disjoint and each unique
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="count"]');
    await wait(280);
    var c1 = await playRound(page, 'count', 5);
    assertUnique(c1, 'tellen r1');
    ok('Tellen ronde 1 uniek: ' + c1.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-level="count"]');
    await wait(280);
    var c2 = await playRound(page, 'count', 5);
    assertUnique(c2, 'tellen r2');
    var overlap = intersection(c1, c2);
    if (overlap.length) throw new Error('tellen r2 herhaalde vorige ronde: ' + overlap.join(','));
    ok('Tellen ronde 2 uniek en niet uit ronde 1: ' + c2.join(', '));

    // Plus tot 5: 10 combos, 2+3 != 3+2, unique in round, avoid previous 5
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="plus5"]');
    await wait(280);
    var p1 = await playRound(page, 'plus', 5);
    assertUnique(p1, 'plus5 r1');
    ok('Plus 5 ronde 1 uniek: ' + p1.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-level="plus5"]');
    await wait(280);
    var p2 = await playRound(page, 'plus', 5);
    assertUnique(p2, 'plus5 r2');
    overlap = intersection(p1, p2);
    if (overlap.length) throw new Error('plus5 r2 herhaalde vorige ronde: ' + overlap.join(','));
    ok('Plus 5 ronde 2 uniek en niet uit ronde 1: ' + p2.join(', '));

    // Plus tot 30: 110 sommen, twee rondes zonder overlap
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="plus30"]');
    await wait(280);
    var p30a = await playRound(page, 'plus', 5);
    assertUnique(p30a, 'plus30 r1');
    for (var pi = 0; pi < p30a.length; pi++) {
      var bits = p30a[pi].split('+');
      var aa = parseInt(bits[0], 10), bb = parseInt(bits[1], 10);
      if (!(aa >= 10 && aa <= 20 && bb >= 1 && bb <= 10)) {
        throw new Error('plus30 buiten bereik: ' + p30a[pi]);
      }
    }
    ok('Plus tot 30 ronde 1 uniek: ' + p30a.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-level="plus30"]');
    await wait(280);
    var p30b = await playRound(page, 'plus', 5);
    assertUnique(p30b, 'plus30 r2');
    overlap = intersection(p30a, p30b);
    if (overlap.length) throw new Error('plus30 r2 herhaalde vorige ronde: ' + overlap.join(','));
    ok('Plus tot 30 ronde 2 uniek en niet uit ronde 1: ' + p30b.join(', '));

    // Min (tot 5): 10 combos
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="minus"]');
    await wait(280);
    var m1 = await playRound(page, 'minus', 5);
    assertUnique(m1, 'min r1');
    ok('Min ronde 1 uniek: ' + m1.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-level="minus"]');
    await wait(280);
    var m2 = await playRound(page, 'minus', 5);
    assertUnique(m2, 'min r2');
    overlap = intersection(m1, m2);
    if (overlap.length) throw new Error('min r2 herhaalde vorige ronde: ' + overlap.join(','));
    ok('Min ronde 2 uniek en niet uit ronde 1: ' + m2.join(', '));

    // Min tot 30: 110 sommen over het tiental, twee rondes zonder overlap
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="minus30"]');
    await wait(280);
    var m30a = await playRound(page, 'minus', 5);
    assertUnique(m30a, 'minus30 r1');
    for (var mi = 0; mi < m30a.length; mi++) {
      var mbits = m30a[mi].split('-');
      var mt = parseInt(mbits[0], 10), mk = parseInt(mbits[1], 10);
      if (!(mt >= 11 && mt <= 30 && mk >= 1 && mk <= 10 && mt - mk >= 0)) {
        throw new Error('minus30 buiten bereik: ' + m30a[mi]);
      }
      if (Math.floor((mt - mk) / 10) === Math.floor(mt / 10)) {
        throw new Error('minus30 kruist geen tiental: ' + m30a[mi]);
      }
    }
    ok('Min tot 30 ronde 1 uniek: ' + m30a.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-level="minus30"]');
    await wait(280);
    var m30b = await playRound(page, 'minus', 5);
    assertUnique(m30b, 'minus30 r2');
    var m30over = intersection(m30a, m30b);
    if (m30over.length) throw new Error('minus30 r2 herhaalde vorige ronde: ' + m30over.join(','));
    ok('Min tot 30 ronde 2 uniek en niet uit ronde 1: ' + m30b.join(', '));

    // Tafel van 1: 10 sommen
    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="tables"]');
    await wait(280);
    await page.click('[data-table="1"]');
    await wait(280);
    var t1 = await playRound(page, 'tables', 5);
    assertUnique(t1, 'tafel1 r1');
    ok('Tafel 1 ronde 1 uniek: ' + t1.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-table="1"]');
    await wait(280);
    var t2 = await playRound(page, 'tables', 5);
    assertUnique(t2, 'tafel1 r2');
    overlap = intersection(t1, t2);
    if (overlap.length) throw new Error('tafel1 r2 herhaalde vorige ronde: ' + overlap.join(','));
    ok('Tafel 1 ronde 2 uniek en niet uit ronde 1: ' + t2.join(', '));

    // Letter zoeken, kernletters (8): unique in a round of 5; r2 must include the 3 leftovers
    await fresh(page);
    await page.click('#btn-goto-letters');
    await wait(280);
    await page.click('[data-mode="zoeken"]');
    await wait(280);
    var z1 = await playRound(page, 'zoeken', 5);
    assertUnique(z1, 'zoeken r1');
    ok('Zoeken ronde 1 uniek: ' + z1.join(', '));
    await page.click('#btn-verder');
    await wait(300);
    await page.click('[data-mode="zoeken"]');
    await wait(280);
    var z2 = await playRound(page, 'zoeken', 5);
    assertUnique(z2, 'zoeken r2');
    overlap = intersection(z1, z2);
    if (overlap.length > 2) throw new Error('zoeken r2 te veel herhalingen uit r1: ' + overlap.join(','));
    ok('Zoeken ronde 2 uniek (pool 8, overlap ' + overlap.length + '): ' + z2.join(', '));

    // Begint met
    await fresh(page);
    await page.click('#btn-goto-letters');
    await wait(280);
    await page.click('[data-mode="begint"]');
    await wait(280);
    var b1 = await playRound(page, 'begint', 5);
    assertUnique(b1, 'begint r1');
    ok('Begint met ronde 1 uniek: ' + b1.join(', '));

    async function waitKlinkReady(page, ms) {
      var deadline = Date.now() + (ms || 8000);
      while (Date.now() < deadline) {
        const ready = await page.evaluate(() => {
          var b = document.querySelector('#klink-tiles [data-ok="1"]');
          var word = document.getElementById('klink-word');
          return !!(b && word && word.getAttribute('data-word') && b.getAttribute('data-used') !== '1');
        });
        if (ready) return true;
        await wait(120);
      }
      return false;
    }
    async function playKlinkRound(page, n) {
      var keys = [], i, key;
      for (i = 0; i < n; i++) {
        if (!(await waitKlinkReady(page, 10000))) throw new Error('klinkers not ready item ' + (i + 1));
        key = await page.evaluate(() => (document.getElementById('klink-word') || {}).getAttribute('data-word') || '');
        keys.push(key);
        await page.evaluate(() => {
          var b = document.querySelector('#klink-tiles [data-ok="1"]');
          if (b) b.click();
        });
        if (i < n - 1) {
          var deadline = Date.now() + 10000;
          var moved = false;
          while (Date.now() < deadline) {
            moved = await page.evaluate((prev) => {
              var word = document.getElementById('klink-word');
              var k = word ? word.getAttribute('data-word') : '';
              var b = document.querySelector('#klink-tiles [data-ok="1"]');
              return !!(k && k !== prev && b && b.getAttribute('data-used') !== '1');
            }, key);
            if (moved) break;
            await wait(150);
          }
          if (!moved) throw new Error('klinkers next item did not appear after ' + key);
        }
      }
      var rewDeadline = Date.now() + 12000;
      var rewarded = false;
      while (Date.now() < rewDeadline) {
        rewarded = await page.evaluate(() => {
          var rew = document.getElementById('overlay-reward');
          return !!(rew && rew.className.indexOf('is-hidden') === -1);
        });
        if (rewarded) break;
        await wait(150);
      }
      if (!rewarded) throw new Error('klinkers expected reward after 5, keys=' + keys.join(','));
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-letters');
    await wait(280);
    await page.click('[data-mode="klinkers"]');
    await wait(280);
    var k1 = await playKlinkRound(page, 5);
    assertUnique(k1, 'klinkers r1');
    ok('Klinkers ronde 1 uniek: ' + k1.join(', '));

    var kMenu = Date.now() + 15000;
    var onLetters = false;
    while (Date.now() < kMenu) {
      onLetters = await page.evaluate(() => {
        var el = document.getElementById('screen-letters');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (onLetters) break;
      await wait(150);
    }
    if (!onLetters) throw new Error('klinkers did not return to Letters menu after reward');
    await page.click('[data-mode="klinkers"]');
    await wait(280);
    var k2 = await playKlinkRound(page, 5);
    assertUnique(k2, 'klinkers r2');
    var kOverlap = intersection(k1, k2);
    if (kOverlap.length) throw new Error('klinkers r2 herhaalt r1: ' + kOverlap.join(','));
    ok('Klinkers ronde 2 uniek en niet uit ronde 1: ' + k2.join(', '));

    async function waitLijnReady(page, ms) {
      var deadline = Date.now() + (ms || 10000);
      while (Date.now() < deadline) {
        const ready = await page.evaluate(() => {
          var st = document.getElementById('lijn-stage');
          var cards = document.querySelectorAll('#lijn-cards .lijn-card');
          return !!(st && st.getAttribute('data-busy') !== '1' && cards.length === 4 &&
            document.getElementById('screen-lijn') &&
            document.getElementById('screen-lijn').className.indexOf('is-hidden') === -1);
        });
        if (ready) return true;
        await wait(120);
      }
      return false;
    }
    async function playLijnScreen(page) {
      if (!(await waitLijnReady(page, 10000))) throw new Error('lijn screen not ready');
      const info = await page.evaluate(() => {
        var st = document.getElementById('lijn-stage');
        return {
          key: st ? st.getAttribute('data-key') : '',
          nums: Array.prototype.map.call(document.querySelectorAll('#lijn-cards .lijn-card'), function (b) {
            return b.getAttribute('data-n');
          })
        };
      });
      var i, n;
      for (i = 0; i < info.nums.length; i++) {
        n = info.nums[i];
        await page.evaluate((n) => {
          var b = document.querySelector('.lijn-card[data-n="' + n + '"]');
          if (b) b.click();
        }, n);
        await wait(80);
        await page.evaluate((n) => {
          var h = document.querySelector('.lijn-hit[data-n="' + n + '"]');
          if (h) h.click();
        }, n);
        if (i < info.nums.length - 1) {
          var deadline = Date.now() + 10000;
          var okp = false;
          while (Date.now() < deadline) {
            okp = await page.evaluate((prev) => {
              var st = document.getElementById('lijn-stage');
              var placed = st ? parseInt(st.getAttribute('data-placed') || '0', 10) : 0;
              var busy = st && st.getAttribute('data-busy') === '1';
              return placed >= prev && !busy;
            }, i + 1);
            if (okp) break;
            await wait(150);
          }
          if (!okp) throw new Error('lijn card ' + n + ' did not place, key=' + info.key);
        }
      }
      return info.key;
    }
    async function playLijnRound(page, n) {
      var keys = [], i, key, st;
      for (i = 0; i < n; i++) {
        key = await playLijnScreen(page);
        keys.push(key);
        if (i < n - 1) {
          var deadline = Date.now() + 12000;
          var moved = false;
          while (Date.now() < deadline) {
            moved = await page.evaluate((prev) => {
              var st = document.getElementById('lijn-stage');
              var k = st ? st.getAttribute('data-key') : '';
              var busy = st && st.getAttribute('data-busy') === '1';
              var placed = st ? st.getAttribute('data-placed') : '';
              return !!(k && k !== prev && placed === '0' && !busy);
            }, key);
            if (moved) break;
            await wait(150);
          }
          if (!moved) throw new Error('lijn next screen did not appear after ' + key);
        }
      }
      var rewDeadline = Date.now() + 14000;
      var rewarded = false;
      while (Date.now() < rewDeadline) {
        rewarded = await page.evaluate(() => {
          var rew = document.getElementById('overlay-reward');
          return !!(rew && rew.className.indexOf('is-hidden') === -1);
        });
        if (rewarded) break;
        await wait(150);
      }
      if (!rewarded) throw new Error('lijn expected reward after 5, keys=' + keys.join('|'));
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-games');
    await wait(280);
    await page.click('[data-level="lijn"]');
    await wait(280);
    await page.click('[data-max="10"]');
    await wait(280);
    var l1 = await playLijnRound(page, 5);
    assertUnique(l1, 'lijn r1');
    ok('Getallenlijn tot 10 ronde 1 uniek: ' + l1.join(' | '));

    var lMenu = Date.now() + 15000;
    var onLevel = false;
    while (Date.now() < lMenu) {
      onLevel = await page.evaluate(() => {
        var el = document.getElementById('screen-lijnlevel');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (onLevel) break;
      await wait(150);
    }
    if (!onLevel) throw new Error('lijn did not return to level menu after reward');
    await page.click('[data-max="10"]');
    await wait(280);
    var l2 = await playLijnRound(page, 5);
    assertUnique(l2, 'lijn r2');
    var lOverlap = intersection(l1, l2);
    if (lOverlap.length) throw new Error('lijn r2 herhaalt r1: ' + lOverlap.join(','));
    ok('Getallenlijn tot 10 ronde 2 uniek en niet uit ronde 1: ' + l2.join(' | '));

    async function waitDoolhofReady(page, ms) {
      var deadline = Date.now() + (ms || 10000);
      while (Date.now() < deadline) {
        const ready = await page.evaluate(() => {
          var w = document.getElementById('doolhof-wrap');
          var scr = document.getElementById('screen-doolhof');
          return !!(scr && scr.className.indexOf('is-hidden') === -1 &&
            w && w.getAttribute('data-sol') && w.getAttribute('data-done') !== '1' &&
            parseInt(w.getAttribute('data-cell') || '0', 10) > 0);
        });
        if (ready) return true;
        await wait(120);
      }
      return false;
    }
    async function solveDoolhof(page) {
      if (!(await waitDoolhofReady(page, 10000))) throw new Error('doolhof not ready');
      const info = await page.evaluate(() => {
        var w = document.getElementById('doolhof-wrap');
        var r = w.getBoundingClientRect();
        return {
          sol: w.getAttribute('data-sol') || '',
          key: w.getAttribute('data-key') || '',
          cell: parseInt(w.getAttribute('data-cell'), 10),
          ox: parseInt(w.getAttribute('data-ox'), 10),
          oy: parseInt(w.getAttribute('data-oy'), 10),
          left: r.left,
          top: r.top
        };
      });
      var cells = info.sol.split(';'), i, p, parts;
      if (!cells.length) throw new Error('doolhof empty sol for ' + info.key);
      function pos(s) {
        parts = s.split(',');
        return {
          x: info.left + info.ox + (parseInt(parts[1], 10) + 0.5) * info.cell,
          y: info.top + info.oy + (parseInt(parts[0], 10) + 0.5) * info.cell
        };
      }
      p = pos(cells[0]);
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      for (i = 1; i < cells.length; i++) {
        p = pos(cells[i]);
        await page.mouse.move(p.x, p.y, { steps: 4 });
        await wait(20);
      }
      await page.mouse.up();
      return info.key;
    }
    async function playDoolhofRound(page, n) {
      var keys = [], i, key, moved, deadline, rewarded;
      for (i = 0; i < n; i++) {
        key = await solveDoolhof(page);
        keys.push(key);
        if (i < n - 1) {
          deadline = Date.now() + 12000;
          moved = false;
          while (Date.now() < deadline) {
            moved = await page.evaluate((prev) => {
              var w = document.getElementById('doolhof-wrap');
              var k = w ? w.getAttribute('data-key') : '';
              var done = w && w.getAttribute('data-done') === '1';
              return !!(k && k !== prev && !done);
            }, key);
            if (moved) break;
            await wait(150);
          }
          if (!moved) throw new Error('doolhof next maze did not appear after ' + key);
        }
      }
      deadline = Date.now() + 14000;
      rewarded = false;
      while (Date.now() < deadline) {
        rewarded = await page.evaluate(() => {
          var rew = document.getElementById('overlay-reward');
          return !!(rew && rew.className.indexOf('is-hidden') === -1);
        });
        if (rewarded) break;
        await wait(150);
      }
      if (!rewarded) throw new Error('doolhof expected reward after 5, keys=' + keys.join('|'));
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-puzzles');
    await wait(280);
    await page.click('[data-game="doolhof"]');
    await wait(280);
    await page.click('[data-n="5"]');
    await wait(400);
    var d1 = await playDoolhofRound(page, 5);
    assertUnique(d1, 'doolhof r1');
    ok('Doolhofje klein ronde 1 uniek: ' + d1.join(' | '));

    var dMenu = Date.now() + 15000;
    var onPuzz = false;
    while (Date.now() < dMenu) {
      onPuzz = await page.evaluate(() => {
        var el = document.getElementById('screen-puzzles');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (onPuzz) break;
      await wait(150);
    }
    if (!onPuzz) throw new Error('doolhof did not return to Puzzels after reward');
    await page.click('[data-game="doolhof"]');
    await wait(280);
    await page.click('[data-n="5"]');
    await wait(400);
    var d2 = await playDoolhofRound(page, 5);
    assertUnique(d2, 'doolhof r2');
    var dOverlap = intersection(d1, d2);
    if (dOverlap.length) throw new Error('doolhof r2 herhaalt r1: ' + dOverlap.join(','));
    ok('Doolhofje klein ronde 2 uniek en niet uit ronde 1: ' + d2.join(' | '));



    async function waitWegReady(page, ms) {
      var deadline = Date.now() + (ms || 6000);
      while (Date.now() < deadline) {
        const ready = await page.evaluate(() => {
          var b = document.querySelector('#weg-answers [data-ok="1"]');
          return !!(b && b.className.indexOf('is-correct') === -1);
        });
        if (ready) return true;
        await wait(120);
      }
      return false;
    }
    async function playWegRound(page, n) {
      var keys = [], i, key;
      for (i = 0; i < n; i++) {
        if (!(await waitWegReady(page, 7000))) throw new Error('weg not ready item ' + (i + 1));
        key = await page.evaluate(() => (document.getElementById('weg-board') || {}).getAttribute('data-key') || '');
        keys.push(key);
        await page.evaluate(() => {
          var b = document.querySelector('#weg-answers [data-ok="1"]');
          if (b) b.click();
        });
        await wait(300);
        if (i < n - 1) {
          var deadline = Date.now() + 7000;
          var moved = false;
          while (Date.now() < deadline) {
            moved = await page.evaluate((prev) => {
              var board = document.getElementById('weg-board');
              var k = board ? board.getAttribute('data-key') : '';
              var b = document.querySelector('#weg-answers [data-ok="1"]');
              var looking = board && board.querySelectorAll('.weg-slot').length === 4 && !b;
              return looking || (k && k !== prev && b && b.className.indexOf('is-correct') === -1);
            }, key);
            if (moved) break;
            await wait(150);
          }
          if (!moved) throw new Error('weg next item did not appear after ' + key);
        }
      }
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-memory');
    await wait(280);
    await page.click('[data-game="weg"]');
    await wait(280);
    var w1 = await playWegRound(page, 5);
    assertUnique(w1, 'weg r1');
    ok('Wat is er weg ronde 1 uniek: ' + w1.join(', '));
    // dismiss reward and play a second round
    var rwDeadline = Date.now() + 5000;
    while (Date.now() < rwDeadline) {
      const on = await page.evaluate(() => {
        var el = document.getElementById('overlay-reward');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (on) break;
      await wait(150);
    }
    await page.click('#btn-verder');
    await wait(400);
    await page.click('[data-game="weg"]');
    await wait(280);
    var w2 = await playWegRound(page, 5);
    assertUnique(w2, 'weg r2');
    var wOver = w1.filter(function (k) { return w2.indexOf(k) !== -1; });
    if (wOver.length) throw new Error('weg r2 herhaalde vorige ronde: ' + wOver.join(','));
    ok('Wat is er weg ronde 2 uniek en niet uit ronde 1: ' + w2.join(', '));

    async function waitSimonRepeat(page, prev, ms) {
      var deadline = Date.now() + (ms || 10000);
      while (Date.now() < deadline) {
        const seq = await page.evaluate((prev) => {
          var board = document.getElementById('simon-board');
          if (!board || board.getAttribute('data-phase') !== 'repeat') return null;
          var s = board.getAttribute('data-seq') || '';
          if (!s) return null;
          if (prev && s === prev) return null;
          return s;
        }, prev || '');
        if (seq) return seq;
        await wait(120);
      }
      return null;
    }
    async function playSimonRound(page, n) {
      var keys = [], i, key, parts, j;
      var prev = '';
      for (i = 0; i < n; i++) {
        key = await waitSimonRepeat(page, prev, 10000);
        if (!key) throw new Error('simon not ready item ' + (i + 1));
        keys.push(key);
        parts = key.split('-');
        for (j = 0; j < parts.length; j++) {
          await page.evaluate((idx) => {
            var b = document.querySelector('#simon-board [data-act="simon-pad"][data-i="' + idx + '"]');
            if (b) b.click();
          }, parts[j]);
          await wait(80);
        }
        prev = key;
        await wait(300);
      }
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-memory');
    await wait(280);
    await page.click('[data-game="simon"]');
    await wait(280);
    var s1 = await playSimonRound(page, 5);
    assertUnique(s1, 'simon r1');
    ok('Simon zegt ronde 1 uniek: ' + s1.join(', '));
    var rwS = Date.now() + 5000;
    while (Date.now() < rwS) {
      const on = await page.evaluate(() => {
        var el = document.getElementById('overlay-reward');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (on) break;
      await wait(150);
    }
    await page.click('#btn-verder');
    await wait(400);
    await page.click('[data-game="simon"]');
    await wait(280);
    var s2 = await playSimonRound(page, 5);
    assertUnique(s2, 'simon r2');
    var sOver = s1.filter(function (k) { return s2.indexOf(k) !== -1; });
    if (sOver.length) throw new Error('simon r2 herhaalde vorige ronde: ' + sOver.join(','));
    ok('Simon zegt ronde 2 uniek en niet uit ronde 1: ' + s2.join(', '));

    async function waitRijTik(page, prev, ms) {
      var deadline = Date.now() + (ms || 12000);
      while (Date.now() < deadline) {
        const seq = await page.evaluate((prev) => {
          var row = document.getElementById('rij-row');
          if (!row || row.getAttribute('data-phase') !== 'tik') return null;
          var s = row.getAttribute('data-seq') || '';
          if (!s) return null;
          if (prev && s === prev) return null;
          return s;
        }, prev || '');
        if (seq) return seq;
        await wait(120);
      }
      return null;
    }
    async function playRijRound(page, n) {
      var keys = [], i, key, parts, j;
      var prev = '';
      for (i = 0; i < n; i++) {
        key = await waitRijTik(page, prev, 12000);
        if (!key) throw new Error('rij not ready item ' + (i + 1));
        keys.push(key);
        parts = key.split(',');
        for (j = 0; j < parts.length; j++) {
          await page.evaluate((pic) => {
            var b = document.querySelector('#rij-choices [data-act="rij-pick"][data-pic="' + pic + '"]');
            if (b) b.click();
          }, parts[j]);
          await wait(80);
        }
        prev = key;
        await wait(300);
      }
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-memory');
    await wait(280);
    await page.click('[data-game="rij"]');
    await wait(280);
    var r1 = await playRijRound(page, 5);
    assertUnique(r1, 'rij r1');
    ok('Onthoud de rij ronde 1 uniek: ' + r1.join(', '));
    var rwR = Date.now() + 5000;
    while (Date.now() < rwR) {
      const on = await page.evaluate(() => {
        var el = document.getElementById('overlay-reward');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (on) break;
      await wait(150);
    }
    await page.click('#btn-verder');
    await wait(400);
    await page.click('[data-game="rij"]');
    await wait(280);
    var r2 = await playRijRound(page, 5);
    assertUnique(r2, 'rij r2');
    var rOver = r1.filter(function (k) { return r2.indexOf(k) !== -1; });
    if (rOver.length) throw new Error('rij r2 herhaalde vorige ronde: ' + rOver.join(','));
    ok('Onthoud de rij ronde 2 uniek en niet uit ronde 1: ' + r2.join(', '));


    async function waitCupsPick(page, prev, ms) {
      var deadline = Date.now() + (ms || 16000);
      while (Date.now() < deadline) {
        const key = await page.evaluate((prev) => {
          var stage = document.getElementById('cups-stage');
          if (!stage || stage.getAttribute('data-phase') !== 'pick') return null;
          var s = stage.getAttribute('data-key') || '';
          if (!s) return null;
          if (prev && s === prev) return null;
          return s;
        }, prev || '');
        if (key) return key;
        await wait(120);
      }
      return null;
    }
    async function playCupsRound(page, n) {
      var keys = [], i, key;
      var prev = '';
      for (i = 0; i < n; i++) {
        key = await waitCupsPick(page, prev, 16000);
        if (!key) throw new Error('cups not ready item ' + (i + 1));
        keys.push(key);
        await page.evaluate(() => {
          var b = document.querySelector('#cups-stage .cup-slot[data-has="1"] .cup-hit');
          if (b) b.click();
        });
        prev = key;
        await wait(300);
      }
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-memory');
    await wait(280);
    await page.click('[data-game="cups"]');
    await wait(280);
    var c1 = await playCupsRound(page, 5);
    assertUnique(c1, 'cups r1');
    ok('Waar zat het? ronde 1 uniek: ' + c1.join(', '));
    var rwC = Date.now() + 5000;
    while (Date.now() < rwC) {
      const on = await page.evaluate(() => {
        var el = document.getElementById('overlay-reward');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (on) break;
      await wait(150);
    }
    await page.click('#btn-verder');
    await wait(400);
    await page.click('[data-game="cups"]');
    await wait(280);
    var c2 = await playCupsRound(page, 5);
    assertUnique(c2, 'cups r2');
    var cOver = c1.filter(function (k) { return c2.indexOf(k) !== -1; });
    if (cOver.length) throw new Error('cups r2 herhaalde vorige ronde: ' + cOver.join(','));
    ok('Waar zat het? ronde 2 uniek en niet uit ronde 1: ' + c2.join(', '));


    async function waitVeranderdAsk(page, prev, ms) {
      var deadline = Date.now() + (ms || 10000);
      while (Date.now() < deadline) {
        const key = await page.evaluate((prev) => {
          var board = document.getElementById('veranderd-board');
          if (!board || board.getAttribute('data-phase') !== 'ask') return null;
          var s = board.getAttribute('data-key') || '';
          if (!s) return null;
          if (prev && s === prev) return null;
          return s;
        }, prev || '');
        if (key) return key;
        await wait(120);
      }
      return null;
    }
    async function playVeranderdRound(page, n) {
      var keys = [], i, key;
      var prev = '';
      for (i = 0; i < n; i++) {
        key = await waitVeranderdAsk(page, prev, 10000);
        if (!key) throw new Error('veranderd not ready item ' + (i + 1));
        keys.push(key);
        await page.evaluate(() => {
          var b = document.querySelector('#veranderd-board [data-ok="1"]');
          if (b) b.click();
        });
        prev = key;
        await wait(300);
      }
      return keys;
    }

    await fresh(page);
    await page.click('#btn-goto-memory');
    await wait(280);
    await page.click('[data-game="veranderd"]');
    await wait(280);
    var v1 = await playVeranderdRound(page, 5);
    assertUnique(v1, 'veranderd r1');
    ok('Wat is er veranderd? ronde 1 uniek: ' + v1.join(', '));
    var rwV = Date.now() + 5000;
    while (Date.now() < rwV) {
      const on = await page.evaluate(() => {
        var el = document.getElementById('overlay-reward');
        return !!(el && el.className.indexOf('is-hidden') === -1);
      });
      if (on) break;
      await wait(150);
    }
    await page.click('#btn-verder');
    await wait(400);
    await page.click('[data-game="veranderd"]');
    await wait(280);
    var v2 = await playVeranderdRound(page, 5);
    assertUnique(v2, 'veranderd r2');
    var vOver = v1.filter(function (k) { return v2.indexOf(k) !== -1; });
    if (vOver.length) throw new Error('veranderd r2 herhaalde vorige ronde: ' + vOver.join(','));
    ok('Wat is er veranderd? ronde 2 uniek en niet uit ronde 1: ' + v2.join(', '));

    console.log('\nALL UNIQUE-ROUND CHECKS OK (' + results.length + ')');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('\nTEST FAILED');
    console.error(results.join('\n'));
    console.error(e && e.stack ? e.stack : e);
    try { await page.screenshot({ path: '/workspace/rekenapp/screenshots/unique-test-fail.png' }); } catch (e2) {}
    await browser.close();
    process.exit(1);
  }
})();
