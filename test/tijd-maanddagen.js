/**
 * Checks for Tijd / Hoeveel dagen heeft…?
 *   NODE_PATH=/path/to/node_modules node test/tijd-maanddagen.js
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
    if (!t || !t.startMaanddagen || !t.MD_BIN) {
      out.push('FAIL no __tijdTest.startMaanddagen');
      return out;
    }
    eq(t.MD_BIN.apr, '30', 'april heeft 30 dagen');
    eq(t.MD_BIN.jan, '31', 'januari heeft 31 dagen');
    eq(t.MD_BIN.feb, '28', 'februari valt in 28 of 29');
    eq(t.mdFind('quiz', 'md-q-apr').answer, '30', 'vraag april = 30');
    eq(t.mdFind('quiz', 'md-q-feb').answer, '28 of 29', 'vraag februari = 28 of 29');
    eq(t.mdFind('quiz', 'md-q-jaar').answer, '365', 'jaar = 365 dagen');
    var quiz = t.mdPool('quiz');
    var sort = t.mdPool('sorteer');
    assert(quiz.length === 13, 'quiz-pool 12 maanden + jaar (' + quiz.length + ')');
    assert(sort.length === 5 + 13, 'sorteer-pool 5 + 13 vragen (' + sort.length + ')');
    var i, q;
    for (i = 0; i < quiz.length; i++) {
      q = quiz[i];
      assert(q.options.indexOf(q.answer) !== -1, q.id + ' bevat het antwoord');
    }

    t.startMaanddagen('quiz', true, 'md-q-apr');
    var st = t.mdState();
    eq(st.mode, 'quiz', 'april is quiz');
    eq(st.answer, '30', 'antwoord 30');
    assert(document.querySelectorAll('#tijd-choices [data-act="md-answer"]').length === 3, '3 knoppen');
    assert(document.querySelector('.md-cal-name') && document.querySelector('.md-cal-name').textContent === 'april', 'kalender toont april');
    assert(!document.getElementById('tijd-clock').innerHTML.match(/\\b30\\b/), 'plaatje verraadt het aantal niet');

    t.startMaanddagen('sorteer', true, 'sort-a');
    st = t.mdState();
    eq(st.mode, 'sort', 'sort-a is sorteer');
    eq(st.tray.length, 6, '6 maanden in bakje');
    t.mdPlace('jan', '31');
    t.mdPlace('apr', '30');
    t.mdPlace('mei', '31');
    t.mdPlace('jun', '30');
    t.mdPlace('sep', '30');
    t.mdPlace('nov', '30');
    t.mdRender();
    st = t.mdState();
    eq(st.tray.length, 0, 'bakje leeg');
    t.mdKlaar();
    assert(true, 'juiste sortering geaccepteerd');

    t.startMaanddagen('sorteer', false, 'sort-all');
    st = t.mdState();
    eq(st.months.length, 12, 'sort-all heeft 12 maanden');
    assert(document.querySelectorAll('#tijd-md-bins .md-bin').length === 3, '3 bakjes');
    assert(document.getElementById('btn-md-knuckle'), 'knop Knokkels');
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  if (failed) {
    console.error('UNIT FAILED', failed);
    await page.screenshot({ path: SHOT + '/md-test-fail.png' });
    await browser.close();
    process.exit(1);
  }
  ok('feiten, quiz en sorteer');

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.click('#btn-goto-tijd');
  await wait(250);
  if (!(await page.$('#tijd-grid [data-game="maanddagen"]'))) throw new Error('geen tegel');
  await page.click('#tijd-grid [data-game="maanddagen"]');
  await wait(250);
  if (!(await page.$('#tijdlevel-grid [data-kind="sorteer"]'))) throw new Error('geen Sorteer');
  ok('menu en kiezer');

  await page.evaluate(function () {
    window.__tijdTest.startMaanddagen('sorteer', true, 'sort-all');
  });
  await wait(200);
  // place a couple so the bins aren't empty in the shot? keep tray full to show the task
  // show knuckles briefly for a distinctive shot
  await page.evaluate(function () { window.__tijdTest.mdPlayKnuckle(); });
  await wait(900); // first month highlighted
  if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
  await page.screenshot({ path: SHOT + '/53-tijd-maanddagen.png', type: 'png' });
  ok('screenshot ' + SHOT + '/53-tijd-maanddagen.png');

  await browser.close();
  console.log('\nALL TIJD MAANDDAGEN CHECKS OK');
})().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
