/**
 * Unit + smoke checks for the Geld games.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/geld-levels.js
 */
const puppeteer = require('puppeteer-core');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function ok(msg) { console.log('OK  ' + msg); }

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  const report = await page.evaluate(() => {
    var t = window.__geldTest;
    var out = [];
    function eq(a, b, msg) {
      if (a !== b) out.push('FAIL ' + msg + ' (got ' + a + ', expected ' + b + ')');
      else out.push('OK ' + msg);
    }
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t) {
      out.push('FAIL no __geldTest');
      return out;
    }
    eq(t.formatEuro(0), '€0,00', 'format 0');
    eq(t.formatEuro(8), '€0,08', 'format 8 cent');
    eq(t.formatEuro(50), '€0,50', 'format 50 cent');
    eq(t.formatEuro(100), '€1,00', 'format 1 euro');
    eq(t.formatEuro(228), '€2,28', 'format 2,28');
    eq(t.formatEuro(1450), '€14,50', 'format 14,50');
    eq(t.formatEuro(3720), '€37,20', 'format 37,20');

    function greedyOk(target, denoms, msg) {
      var parts = t.greedy(target, denoms);
      var sum = 0, i;
      if (!parts) {
        out.push('FAIL ' + msg + ' no combo');
        return;
      }
      for (i = 0; i < parts.length; i++) sum += parts[i];
      eq(sum, target, msg);
    }
    greedyOk(8, [10, 5, 2, 1], 'greedy 8 cent');
    greedyOk(48, [50, 20, 10, 5, 2, 1], 'greedy 48 cent');
    greedyOk(228, [200, 100, 50, 20, 10, 5, 2, 1], 'greedy 2,28');
    greedyOk(1450, [2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1], 'greedy 14,50 with notes');
    greedyOk(3720, [2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1], 'greedy 37,20 with notes');

    function checkPool(pool, minC, maxC, label) {
      var i, keys = {}, k, c, n = 0;
      for (i = 0; i < pool.length; i++) {
        if (typeof pool[i] === 'number') {
          c = pool[i];
          k = String(c);
        } else {
          c = pool[i].cents;
          k = pool[i].id + ':' + c;
        }
        n += 1;
        if (keys[k]) out.push('FAIL ' + label + ' duplicate ' + k);
        keys[k] = 1;
        if (c < minC || c > maxC) out.push('FAIL ' + label + ' out of range ' + c);
      }
      assert(n >= 10, label + ' has ' + n + ' items (>=10)');
    }
    checkPool(t.pools.pot10, 1, 10, 'spaarpot tot 10');
    checkPool(t.pools.pot50, 11, 50, 'spaarpot tot 50');
    checkPool(t.pools.winkel1, 1, 100, 'winkeltje tot 1');
    checkPool(t.pools.winkel5, 101, 500, 'winkeltje tot 5');
    checkPool(t.pools.brief20, 501, 2000, 'briefjes tot 20');
    checkPool(t.pools.brief50, 2001, 5000, 'briefjes tot 50');
    return out;
  });
  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  // smoke: start spaarpot, pay exact, should lock/praise
  await page.click('#btn-goto-geld');
  await wait(250);
  await page.click('#geld-grid [data-game="pot"]');
  await wait(250);
  await page.click('#geldlevel-grid [data-max="10"]');
  await wait(400);
  const smoke1 = await page.evaluate(() => {
    var w = document.getElementById('geld-play');
    return {
      screen: !document.getElementById('screen-geldplay').className.includes('is-hidden'),
      target: w && w.getAttribute('data-target'),
      tray: document.querySelectorAll('#geld-tray [data-geld-tray]').length
    };
  });
  if (!smoke1.screen) throw new Error('spaarpot screen not visible');
  if (smoke1.tray !== 4) throw new Error('spaarpot tot 10 should have 4 coins, got ' + smoke1.tray);
  ok('spaarpot tot 10 tray has 4 coins, target ' + smoke1.target);

  await page.evaluate(() => window.__geldTest.payExact());
  await wait(600);
  const paid = await page.evaluate(() => {
    var w = document.getElementById('geld-play');
    return { paid: w.getAttribute('data-paid'), target: w.getAttribute('data-target'), busy: w.getAttribute('data-busy') };
  });
  if (paid.paid !== paid.target) throw new Error('payExact mismatch ' + JSON.stringify(paid));
  if (paid.busy !== '1') throw new Error('expected lock after correct Klaar');
  ok('spaarpot payExact matches target and locks');

  // briefjes tray includes 3 notes
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0' });
  await page.click('#btn-goto-geld');
  await wait(250);
  await page.click('#geld-grid [data-game="brief"]');
  await wait(250);
  await page.click('#geldlevel-grid [data-max="2000"]');
  await wait(400);
  const brief = await page.evaluate(() => {
    var w = document.getElementById('geld-play');
    return {
      notes: document.querySelectorAll('#geld-tray .geld-note-wrap').length,
      coins: document.querySelectorAll('#geld-tray .geld-coin-wrap').length,
      target: parseInt(w.getAttribute('data-target'), 10)
    };
  });
  if (brief.notes !== 3) throw new Error('expected 3 notes, got ' + brief.notes);
  if (brief.coins !== 8) throw new Error('expected 8 coins, got ' + brief.coins);
  if (brief.target < 501 || brief.target > 2000) throw new Error('brief 20 target out of range ' + brief.target);
  ok('briefjes tot €20 tray has 8 coins + 3 notes, target ' + brief.target);

  await browser.close();
  if (failed) {
    console.log('\nGELD LEVEL CHECKS FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('\nALL GELD LEVEL CHECKS OK');
}

main().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
