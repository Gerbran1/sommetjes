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
      localStorage.setItem('sommetjes-sound', '0');
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
