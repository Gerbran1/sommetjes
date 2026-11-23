/**
 * Checks for Tijd / Seizoenen
 *   NODE_PATH=/path/to/node_modules node test/tijd-seizoenen.js
 */
'use strict';
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SHOT = process.env.SHOT_DIR || '/workspace/rekenapp/screenshots';
function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });

  const report = await page.evaluate(function () {
    var t = window.__tijdTest;
    var out = [];
    function eq(a, b, msg) {
      if (a !== b) out.push('FAIL ' + msg + ' (got ' + a + ', expected ' + b + ')');
      else out.push('OK ' + msg);
    }
    function assert(cond, msg) { out.push((cond ? 'OK ' : 'FAIL ') + msg); }
    if (!t || !t.startSeizoen || !t.SEZ_MONTH) {
      out.push('FAIL no __tijdTest.startSeizoen');
      return out;
    }
    eq(t.SEZ_LIST.length, 4, '4 seizoenen');
    eq(t.SEZ_LIST[0].id, 'lente', 'volgorde begint met lente');
    eq(t.SEZ_MONTH.dec, 'winter', 'december is winter (meteorologisch)');
    eq(t.SEZ_MONTH.mrt, 'lente', 'maart is lente');
    eq(t.SEZ_MONTH.jun, 'zomer', 'juni is zomer');
    eq(t.SEZ_MONTH.sep, 'herfst', 'september is herfst');
    eq(t.SEZ_MONTH.jan, 'winter', 'januari is winter');
    eq(t.SEZ_MONTH.feb, 'winter', 'februari is winter');
    eq(t.sezFind('vragen', 'sez-m-dec').answer, 'winter', 'vraag december = winter');
    eq(t.sezFind('vragen', 'sc-zomer-zon').answer, 'zomer', 'zonnescene = zomer');

    var vrg = t.sezPool('vragen');
    var srt = t.sezPool('sorteer');
    assert(vrg.length === 8 + 12, 'vragen: 8 scenes + 12 maanden (' + vrg.length + ')');
    assert(srt.length === 3 + 2 + 8 + 12, 'sorteer-pool bevat kleding, cirkel en vragen (' + srt.length + ')');

    t.startSeizoen('vragen', true, 'sez-m-dec');
    var st = t.sezState();
    eq(st.mode, 'maand', 'december is maandvraag');
    assert(document.querySelectorAll('#tijd-choices [data-act="sez-answer"]').length === 4, '4 seizoensknoppen');
    assert(document.querySelector('.sez-month-name') && document.querySelector('.sez-month-name').textContent === 'december', 'toont december');

    t.startSeizoen('sorteer', true, 'circle-lente');
    st = t.sezState();
    eq(st.mode, 'circle', 'cirkel-opgave');
    eq(st.slots[0], 'lente', 'lente staat vast bovenaan');
    eq(st.tray.length, 3, '3 seizoenen in het bakje');
    t.sezPlaceCircle('zomer', 1);
    t.sezPlaceCircle('herfst', 2);
    t.sezPlaceCircle('winter', 3);
    t.sezRenderCircle();
    st = t.sezState();
    eq(st.tray.length, 0, 'bakje leeg');
    t.sezKlaar();
    assert(true, 'juiste cirkel geaccepteerd');

    t.startSeizoen('sorteer', false, 'kled-a');
    st = t.sezState();
    eq(st.mode, 'kleding', 'kleding-opgave');
    eq(st.tray.length, 4, '4 kledingstukken');
    t.sezPlaceCloth('jas', 'winter');
    t.sezPlaceCloth('hoed', 'zomer');
    t.sezPlaceCloth('regenjas', 'lente');
    t.sezPlaceCloth('trui', 'herfst');
    t.sezRenderKleding();
    t.sezKlaar();
    assert(document.querySelectorAll('#tijd-sez-bins .sez-bin').length === 4, '4 seizoensbakjes');
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  if (failed) {
    console.error('UNIT FAILED', failed);
    await page.screenshot({ path: SHOT + '/sez-test-fail.png' });
    await browser.close();
    process.exit(1);
  }
  ok('indeling, cirkel, kleding en vragen');

  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.click('#btn-goto-tijd');
  await wait(250);
  if (!(await page.$('#tijd-grid [data-game="seizoen"]'))) throw new Error('geen tegel Seizoenen');
  await page.click('#tijd-grid [data-game="seizoen"]');
  await wait(250);
  if (!(await page.$('#tijdlevel-grid [data-kind="sorteer"]'))) throw new Error('geen Sorteer');
  ok('menu en kiezer');

  await page.evaluate(function () {
    window.__tijdTest.startSeizoen('sorteer', true, 'circle-lente');
  });
  await wait(300);
  if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: SHOT + '/53-tijd-seizoenen.png' });
  ok('screenshot ' + SHOT + '/53-tijd-seizoenen.png');

  await browser.close();
  console.log('\nALL TIJD SEIZOENEN CHECKS OK');
})().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
