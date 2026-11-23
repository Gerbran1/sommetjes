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

    if (!t.uniqueHtml) out.push('FAIL no uniqueHtml hook');
    else {
      var sample = '<svg><defs><radialGradient id="GCOIN_gold"></radialGradient></defs><circle fill="url(#GCOIN_gold)"/></svg>';
      var u1 = t.uniqueHtml(sample);
      var u2 = t.uniqueHtml(sample);
      assert(u1.indexOf('id="gdg') !== -1 && u1.indexOf('url(#gdg') !== -1, 'uniqueHtml prefix id en url');
      assert(u1 !== u2, 'twee klonen krijgen verschillende ids');
      assert(u1.indexOf('id="GCOIN_gold"') === -1, 'originele id verdwijnt in de kloon');
      var id1 = u1.match(/id="([^"]+)"/)[1];
      var url1 = u1.match(/url\(#([^)]+)\)/)[1];
      eq(id1, url1, 'url verwijst naar de nieuwe id');
    }
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

  // Return coins/notes from kassa and spaarpot (tap + counter)
  const retReport = await page.evaluate(() => {
    var t = window.__geldTest;
    var out = [];
    function assert(cond, msg) { out.push((cond ? 'OK ' : 'FAIL ') + msg); }
    var st, paid, amt, items, i, cls, act;

    t.start('winkel', 100, true);
    st = t.state();
    st.target = 50;
    st.coins = [50, 20];
    t.render();
    items = document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]');
    assert(items.length === 2, 'winkeltje kassa toont 2 betaalde munten');
    for (i = 0; i < items.length; i++) {
      cls = ' ' + items[i].className + ' ';
      assert(cls.indexOf(' tap ') !== -1, 'winkeltje munt ' + i + ' heeft class tap');
    }
    amt = document.getElementById('geld-ks-amt');
    assert(amt && amt.textContent === '€0,70', 'winkeltje Je hebt start €0,70 (got ' + (amt && amt.textContent) + ')');
    t.returnCoin(1);
    assert(t.state().coins.length === 1 && t.state().coins[0] === 50, 'winkeltje terug: 20 cent eruit, 50 blijft');
    assert(amt.textContent === '€0,50', 'winkeltje teller na terug €0,50 (got ' + amt.textContent + ')');
    items = document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]');
    assert(items.length === 1, 'winkeltje kassa heeft 1 munt na terug');

    t.start('pot', 10, true);
    st = t.state();
    st.target = 5;
    st.coins = [5, 2];
    t.render();
    items = document.querySelectorAll('#geld-dropped [data-act="geld-return"]');
    assert(items.length === 2, 'spaarpot toont 2 betaalde munten');
    cls = ' ' + items[0].className + ' ';
    assert(cls.indexOf(' tap ') !== -1, 'spaarpot munt heeft class tap');
    amt = document.getElementById('geld-total');
    assert(amt && amt.textContent === 'Nu: 7 cent', 'spaarpot Nu: 7 cent (got ' + (amt && amt.textContent) + ')');
    t.returnCoin(0);
    assert(t.state().coins.length === 1 && t.state().coins[0] === 2, 'spaarpot terug: 5 eruit, 2 blijft');
    assert(amt.textContent === 'Nu: 2 cent', 'spaarpot teller na terug Nu: 2 cent (got ' + amt.textContent + ')');

    t.start('brief', 2000, true);
    st = t.state();
    st.target = 1000;
    st.coins = [1000, 500];
    t.render();
    items = document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]');
    assert(items.length === 2, 'briefjes kassa toont 2 briefjes');
    cls = ' ' + items[0].className + ' ';
    assert(cls.indexOf(' tap ') !== -1 && items[0].className.indexOf('geld-note-wrap') !== -1, 'briefje heeft tap + note-wrap');
    amt = document.getElementById('geld-ks-amt');
    assert(amt && amt.textContent === '€15,00', 'briefjes Je hebt start €15,00 (got ' + (amt && amt.textContent) + ')');
    t.returnCoin(1);
    assert(t.state().coins.length === 1 && t.state().coins[0] === 1000, 'briefje van €5 terug');
    assert(amt.textContent === '€10,00', 'briefjes teller na terug €10,00 (got ' + amt.textContent + ')');

    return out;
  });
  for (i = 0; i < retReport.length; i++) {
    console.log(retReport[i]);
    if (retReport[i].indexOf('FAIL') === 0) failed += 1;
  }

  // Click a kassa coin (DOM tap) and confirm the counter updates
  await page.evaluate(() => {
    var t = window.__geldTest;
    t.start('winkel', 100, true);
    var st = t.state();
    st.target = 50;
    st.coins = [50, 20, 10];
    st.product = st.product || 'appel';
    t.render();
  });
  await wait(200);
  var beforeClick = await page.evaluate(() => {
    return {
      n: document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]').length,
      amt: document.getElementById('geld-ks-amt').textContent
    };
  });
  if (beforeClick.n !== 3 || beforeClick.amt !== '€0,80') {
    throw new Error('pre-click kassa unexpected ' + JSON.stringify(beforeClick));
  }
  await page.click('#geld-kassa-coins [data-act="geld-return"]');
  await wait(150);
  var afterClick = await page.evaluate(() => {
    return {
      n: document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]').length,
      amt: document.getElementById('geld-ks-amt').textContent,
      coins: window.__geldTest.state().coins.slice()
    };
  });
  if (afterClick.n !== 2) throw new Error('tap return should leave 2 coins, got ' + JSON.stringify(afterClick));
  if (afterClick.amt !== '€0,30' && afterClick.amt !== '€0,70' && afterClick.amt !== '€0,60') {
    throw new Error('tap return amount unexpected ' + JSON.stringify(afterClick));
  }
  ok('tik op kassa-munt haalt hem terug, teller ' + afterClick.amt);

  // Drag a remaining kassa coin out of the drop zone
  var dragInfo = await page.evaluate(() => {
    var el = document.querySelector('#geld-kassa-coins [data-act="geld-return"]');
    var r = el.getBoundingClientRect();
    var tray = document.getElementById('geld-tray');
    var tr = tray.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      tx: tr.left + tr.width / 2,
      ty: tr.top + tr.height / 2,
      before: window.__geldTest.state().coins.length
    };
  });
  await page.mouse.move(dragInfo.x, dragInfo.y);
  await page.mouse.down();
  await page.mouse.move(dragInfo.tx, dragInfo.ty, { steps: 8 });
  await page.mouse.up();
  await wait(150);
  var afterDrag = await page.evaluate(() => {
    return {
      n: document.querySelectorAll('#geld-kassa-coins [data-act="geld-return"]').length,
      amt: document.getElementById('geld-ks-amt').textContent,
      coins: window.__geldTest.state().coins.slice()
    };
  });
  if (afterDrag.n !== 1) throw new Error('drag return should leave 1 coin, got ' + JSON.stringify(afterDrag));
  ok('sleep kassa-munt terug, teller ' + afterDrag.amt);

  // Screenshot: overpay in winkeltje with toast hint
  await wait(700);
  await page.evaluate(() => {
    var t = window.__geldTest;
    t.start('winkel', 100, true);
    var st = t.state();
    st.target = 40;
    st.coins = [50, 20];
    t.render();
    t.klaar();
  });
  await wait(280);
  var toastTxt = await page.evaluate(() => {
    var el = document.getElementById('toast');
    return el ? (el.textContent || '') : '';
  });
  if (toastTxt.indexOf('Haal er wat uit') === -1) {
    throw new Error('expected teveel toast hint, got ' + JSON.stringify(toastTxt));
  }
  ok('toast na te veel: ' + toastTxt);
  var shotDir = '/workspace/rekenapp/screenshots';
  var fs = require('fs');
  if (!fs.existsSync(shotDir)) fs.mkdirSync(shotDir, { recursive: true });
  var shotPath = shotDir + '/55-kassa-terug.png';
  await page.screenshot({ path: shotPath, type: 'png' });
  ok('screenshot ' + shotPath);

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
