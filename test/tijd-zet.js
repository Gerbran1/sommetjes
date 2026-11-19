/**
 * Checks for Tijd / Zet de klok.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/tijd-zet.js
 */
'use strict';
const puppeteer = require('puppeteer-core');
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
    if (!t || !t.startZet) {
      out.push('FAIL no __tijdTest.startZet');
      return out;
    }
    eq(t.snapMinute(0), 0, 'snap 0° → 0');
    eq(t.snapMinute(14), 0, 'snap 14° → 0');
    eq(t.snapMinute(15), 5, 'snap 15° → 5');
    eq(t.snapMinute(30), 5, 'snap 30° → 5');
    eq(t.snapMinute(90), 15, 'snap 90° → 15');
    eq(t.snapMinute(180), 30, 'snap 180° → 30');
    eq(t.snapMinute(345), 0, 'snap 345° → 0');
    eq(t.hourFromAngle(0), 12, 'hour 0° → 12');
    eq(t.hourFromAngle(15), 1, 'hour 15° → 1');
    eq(t.hourFromAngle(180), 6, 'hour 180° → 6');

    t.startZet('kwart', true, { h: 6, m: 15 });
    var st = t.zetState();
    eq(st.targetH, 6, 'target 6');
    eq(st.targetM, 15, 'target 15');
    eq(st.phrase, 'kwart over zes', 'phrase');
    eq(st.h, 12, 'start hour 12');
    eq(st.m, 0, 'start minute 0');
    assert(!t.handsOk(), '12:00 is not yet correct');

    t.setMinutes(55);
    st = t.zetState();
    eq(st.h, 11, 'minute wrap back 12:00 → 11:55');
    eq(st.m, 55, 'minute 55');
    t.setMinutes(0);
    st = t.zetState();
    eq(st.h, 12, 'minute wrap forward 11:55 → 12:00');
    eq(st.m, 0, 'back to 0');

    t.setHands(12, 0);
    t.setHour(6);
    st = t.zetState();
    eq(st.h, 6, 'hour drag to 6');
    eq(st.m, 0, 'minutes kept');
    t.setMinutes(15);
    st = t.zetState();
    eq(st.h, 6, 'hour stays 6 after minutes 15');
    eq(st.m, 15, 'minutes 15');
    assert(t.handsOk(), '6:15 is correct');
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  if (failed) {
    console.error('UNIT FAILED', failed);
    await browser.close();
    process.exit(1);
  }
  ok('wijzers: snap, meedraaien en uurwissel');

  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await wait(200);
  await page.evaluate(function () {
    window.__tijdTest.startZet('kwart', true, { h: 6, m: 15 });
  });
  await wait(250);

  const play = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var clock = document.getElementById('tijd-clock');
    var svg = clock ? clock.querySelector('svg') : null;
    var klaar = document.getElementById('btn-tijd-klaar');
    var choices = document.getElementById('tijd-choices');
    var prompt = document.getElementById('tijd-prompt');
    var kr = klaar ? klaar.getBoundingClientRect() : { width: 0, height: 0 };
    var sr = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      hidden: stage && (' ' + stage.className + ' ').indexOf(' is-hidden ') !== -1,
      mode: stage ? stage.className : '',
      phrase: stage ? stage.getAttribute('data-phrase') : '',
      sh: stage ? stage.getAttribute('data-sh') : '',
      sm: stage ? stage.getAttribute('data-sm') : '',
      prompt: prompt ? prompt.textContent : '',
      klaarVisible: !!(klaar && kr.width > 20 && kr.height > 20),
      choicesHidden: !choices || choices.className.indexOf('is-hidden') !== -1 || choices.getBoundingClientRect().height < 4,
      svgW: Math.round(sr.width),
      svgH: Math.round(sr.height)
    };
  });
  if (play.phrase !== 'kwart over zes' || play.prompt.indexOf('Zet de klok op kwart over zes') === -1) {
    console.error('FAIL play prompt', play);
    await browser.close();
    process.exit(1);
  }
  if (!play.klaarVisible || !play.choicesHidden || play.svgW < 140) {
    console.error('FAIL play layout', play);
    await browser.close();
    process.exit(1);
  }
  if (play.sh !== '12' || play.sm !== '0') {
    console.error('FAIL start hands not 12:00', play);
    await browser.close();
    process.exit(1);
  }
  ok('scherm: opdracht, klok op 12:00, knop Klaar!');

  await page.screenshot({ path: SHOT + '/53-tijd-zet.png' });
  ok('screenshot 53-tijd-zet.png');

  await page.click('#btn-tijd-klaar');
  await wait(300);
  const afterWrong = await page.evaluate(function () {
    return {
      ok: document.getElementById('tijd-stage').getAttribute('data-ok'),
      stars: document.getElementById('tijdplay-stars') ? document.getElementById('tijdplay-stars').textContent : ''
    };
  });
  if (afterWrong.ok === '1') {
    console.error('FAIL klaar accepted 12:00', afterWrong);
    await browser.close();
    process.exit(1);
  }
  ok('Klaar! op 12:00 is nog niet goed');

  await page.evaluate(function () { window.__tijdTest.setHands(6, 15); });
  await wait(100);
  await page.click('#btn-tijd-klaar');
  await wait(250);
  const afterOk = await page.evaluate(function () {
    return {
      ok: document.getElementById('tijd-stage').getAttribute('data-ok'),
      sh: document.getElementById('tijd-stage').getAttribute('data-sh'),
      sm: document.getElementById('tijd-stage').getAttribute('data-sm')
    };
  });
  if (afterOk.ok !== '1' || afterOk.sh !== '6' || afterOk.sm !== '15') {
    console.error('FAIL klaar did not accept 6:15', afterOk);
    await browser.close();
    process.exit(1);
  }
  ok('Klaar! op kwart over zes is goed');

  // Drag the minute hand from 12:00 toward 3 (15 min) after a fresh start at 1:00 target? Use 12:00 start, drag minutes only.
  await page.evaluate(function () {
    window.__tijdTest.startZet('vijf', true, { h: 12, m: 15 });
  });
  await wait(200);
  const geom = await page.evaluate(function () {
    var el = document.getElementById('tijd-clock');
    var svg = el && el.querySelector('svg');
    var r = (svg || el).getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rad: Math.min(r.width, r.height) / 2 };
  });
  // target starts at 12:15 so clock starts at 12:00 (not the special 3:00 start)
  await page.mouse.move(geom.cx, geom.cy - geom.rad * 0.75);
  await page.mouse.down();
  await page.mouse.move(geom.cx + geom.rad * 0.75, geom.cy, { steps: 8 });
  await page.mouse.up();
  await wait(150);
  const afterDrag = await page.evaluate(function () {
    var st = window.__tijdTest.zetState();
    return { h: st.h, m: st.m };
  });
  if (afterDrag.m !== 15) {
    console.error('FAIL minute drag did not snap to 15', afterDrag, geom);
    await browser.close();
    process.exit(1);
  }
  ok('minuutwijzer slepen springt naar 15 (kwart)');

  if (failed) {
    await browser.close();
    process.exit(1);
  }
  console.log('ALL TIJD ZET CHECKS OK');
  await browser.close();
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
