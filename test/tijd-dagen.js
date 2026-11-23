/**
 * Checks for Tijd / Dagen en maanden
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/tijd-dagen.js
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
    executablePath: CHROME,
    headless: 'new',
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
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t || !t.startDagen || !t.DAYS || !t.MONTHS) {
      out.push('FAIL no __tijdTest.startDagen');
      return out;
    }
    eq(t.DAYS.length, 7, '7 dagen');
    eq(t.DAYS[0].name, 'maandag', 'week begint op maandag');
    eq(t.DAYS[6].name, 'zondag', 'week eindigt op zondag');
    eq(t.MONTHS.length, 12, '12 maanden');
    eq(t.MONTHS[0].name, 'januari', 'jaar begint op januari');
    eq(t.MONTHS[11].name, 'december', 'jaar eindigt op december');

    eq(t.dagenNeighbor(t.DAYS, 'di', 'na').name, 'woensdag', 'na dinsdag = woensdag');
    eq(t.dagenNeighbor(t.DAYS, 'vr', 'voor').name, 'donderdag', 'voor vrijdag = donderdag');
    eq(t.dagenNeighbor(t.DAYS, 'zo', 'na').name, 'maandag', 'na zondag = maandag');
    eq(t.dagenNeighbor(t.DAYS, 'ma', 'voor').name, 'zondag', 'voor maandag = zondag');
    eq(t.dagenNeighbor(t.MONTHS, 'mei', 'na').name, 'juni', 'na mei = juni');
    eq(t.dagenNeighbor(t.MONTHS, 'dec', 'na').name, 'januari', 'na december = januari');
    eq(t.dagenNeighbor(t.MONTHS, 'jan', 'voor').name, 'december', 'voor januari = december');

    var week = t.dagenPool('week');
    var maand = t.dagenPool('maand');
    var ids = {}, i, q, hasAns;
    assert(week.length === 4 + 14, 'dagen-pool: 4 volgorde + 14 vragen (' + week.length + ')');
    assert(maand.length === 8 + 24, 'maanden-pool: 8 gaten + 24 vragen (' + maand.length + ')');
    for (i = 0; i < week.length; i++) {
      q = week[i];
      if (ids[q.id]) out.push('FAIL dubbel week id ' + q.id);
      ids[q.id] = 1;
      if (q.mode === 'quiz') {
        hasAns = q.options.indexOf(q.answer) !== -1;
        assert(hasAns, q.id + ' bevat het antwoord');
        assert(q.options.length === 3, q.id + ' heeft 3 opties');
      }
    }
    for (i = 0; i < maand.length; i++) {
      q = maand[i];
      if (ids[q.id]) out.push('FAIL dubbel maand id ' + q.id);
      ids[q.id] = 1;
      if (q.mode === 'quiz') {
        hasAns = q.options.indexOf(q.answer) !== -1;
        assert(hasAns, q.id + ' bevat het antwoord');
      }
    }
    eq(t.dagenFind('week', 'qv-na-di').answer, 'woensdag', 'vraag na dinsdag');
    eq(t.dagenFind('week', 'qv-voor-vr').answer, 'donderdag', 'vraag voor vrijdag');
    eq(t.dagenFind('maand', 'qm-na-mei').answer, 'juni', 'vraag na mei');
    eq(t.dagenFind('maand', 'qm-voor-mrt').answer, 'februari', 'vraag voor maart');

    t.startDagen('week', true, 'order-odd');
    var st = t.dagenState();
    eq(st.mode, 'order', 'order-odd is sleep-opgave');
    eq(st.slots.filter(function (x) { return !!x; }).length, 4, '4 dagen vastgezet');
    eq(st.tray.length, 3, '3 dagen in het bakje');
    assert(st.locked[0] && st.slots[0] === 'ma', 'maandag staat vast');
    assert(!!document.querySelector('#tijd-cal-board .dagen-slot'), 'bord is zichtbaar');
    assert(document.querySelectorAll('#tijd-cal-tray .dagen-chip').length === 3, 'bakje toont 3 chips');
    assert(document.getElementById('tijd-klaar-wrap') && document.getElementById('tijd-klaar-wrap').className.indexOf('is-hidden') === -1, 'Klaar zichtbaar bij volgorde');

    t.dagenPlace('di', 1);
    t.dagenPlace('do', 3);
    t.dagenPlace('za', 5);
    t.dagenRender();
    st = t.dagenState();
    eq(st.tray.length, 0, 'bakje leeg na plaatsen');
    t.dagenKlaar();
    assert(document.body.innerHTML.indexOf('tijdplay') !== -1, 'klaar met goede volgorde loopt');

    t.startDagen('week', false, 'qv-na-di');
    st = t.dagenState();
    eq(st.mode, 'quiz', 'na-dinsdag is quiz');
    eq(st.answer, 'woensdag', 'antwoord woensdag');
    assert(document.querySelectorAll('#tijd-choices [data-act="dagen-answer"]').length === 3, '3 antwoordknoppen');
    assert(document.querySelector('.dagen-pill.is-ref') && document.querySelector('.dagen-pill.is-ref').textContent === 'dinsdag', 'dinsdag is gemarkeerd');

    t.startDagen('maand', true, 'gap-mrt-jun-okt');
    st = t.dagenState();
    eq(st.mode, 'order', 'gaten-opgave');
    eq(st.tray.length, 3, '3 ontbrekende maanden in bakje');
    eq(st.slots.filter(function (x) { return !x; }).length, 3, '3 lege vakjes');
    assert(st.slots[0] === 'jan' && st.locked[0], 'januari staat vast');
    assert(!st.slots[2] && !st.locked[2], 'maart ontbreekt');

    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  if (failed) {
    console.error('UNIT FAILED', failed);
    await page.screenshot({ path: SHOT + '/dagen-test-fail.png' });
    await browser.close();
    process.exit(1);
  }
  ok('volgorde, buren, gaten en quiz');

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.click('#btn-goto-tijd');
  await wait(250);
  var tile = await page.$('#tijd-grid [data-game="dagen"]');
  if (!tile) throw new Error('geen tegel Dagen en maanden');
  await tile.click();
  await wait(250);
  var kindBtn = await page.$('#tijdlevel-grid [data-kind="week"]');
  if (!kindBtn) throw new Error('geen niveau Dagen');
  ok('menu en kiezer Dagen');

  await page.evaluate(function () {
    window.__tijdTest.startDagen('week', true, 'order-odd');
  });
  await wait(300);
  if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT, { recursive: true });
  var shotPath = SHOT + '/53-tijd-dagen.png';
  await page.screenshot({ path: shotPath, type: 'png' });
  ok('screenshot ' + shotPath);

  await browser.close();
  console.log('\nALL TIJD DAGEN CHECKS OK');
})().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
