/**
 * Checks for Tijd / Analoog en digitaal.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/tijd-digi.js
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
    if (!t || !t.startDigi) {
      out.push('FAIL no __tijdTest.startDigi');
      return out;
    }
    eq(t.formatDigi(6, 15), '6:15', '6:15');
    eq(t.formatDigi(12, 0), '12:00', '12:00');
    eq(t.formatDigi(1, 5), '1:05', '1:05');
    eq(t.formatDigi(0, 30), '12:30', 'hour 0 → 12:30');
    var sw = t.swapTime(6, 15);
    eq(sw && sw.h, 3, 'swap 6:15 hour');
    eq(sw && sw.m, 30, 'swap 6:15 minute');
    sw = t.swapTime(3, 30);
    eq(sw && sw.h, 6, 'swap 3:30 hour');
    eq(sw && sw.m, 15, 'swap 3:30 minute');
    assert(t.swapTime(6, 30) == null, 'swap 6:30 is dezelfde tijd');
    assert(t.swapTime(12, 0) == null, 'swap 12:00 is dezelfde tijd');

    var pool = t.pool('helehalve');
    eq(pool.length, 24, 'helehalve pool 24');
    pool = t.pool('kwart');
    var d = t.distractors({ h: 6, m: 15 }, pool, 'kwart');
    var keys = d.map(function (o) { return o.h + ':' + o.m; });
    assert(d.length === 2, 'twee afleiders');
    assert(keys.indexOf('3:30') !== -1, 'afleider verwisselde wijzers 3:30 bij 6:15 (got ' + keys.join(',') + ')');

    t.startDigi('kwart', true, { h: 6, m: 15, mode: 'digi2ana' });
    var st = t.digiState();
    eq(st.h, 6, 'target 6');
    eq(st.m, 15, 'target 15');
    eq(st.mode, 'digi2ana', 'mode digi2ana');
    assert(st.options && st.options.length === 3, '3 opties');
    var hasOk = st.options.filter(function (o) { return o.h === 6 && o.m === 15; }).length === 1;
    assert(hasOk, 'goede analoge klok zit in de opties');
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
  ok('digitale notatie, verwisselde wijzers, pools');

  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await wait(200);
  await page.evaluate(function () {
    window.__tijdTest.startDigi('kwart', true, { h: 6, m: 15, mode: 'digi2ana' });
  });
  await wait(250);

  const play = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var clock = document.getElementById('tijd-clock');
    var svg = clock ? clock.querySelector('svg') : null;
    var btns = document.querySelectorAll('#tijd-choices .tijd-choice');
    var prompt = document.getElementById('tijd-prompt');
    var i, opts = [], r, sr;
    sr = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
    for (i = 0; i < btns.length; i++) {
      r = btns[i].getBoundingClientRect();
      opts.push({
        h: btns[i].getAttribute('data-h'),
        m: btns[i].getAttribute('data-m'),
        ok: btns[i].getAttribute('data-ok'),
        hasSvg: !!btns[i].querySelector('svg'),
        w: Math.round(r.width),
        hgt: Math.round(r.height)
      });
    }
    return {
      mode: stage ? stage.getAttribute('data-mode') : '',
      className: stage ? stage.className : '',
      digital: stage ? stage.getAttribute('data-digital') : '',
      prompt: prompt ? prompt.textContent : '',
      svgText: svg ? (svg.textContent || '').replace(/\s+/g, '') : '',
      svgW: Math.round(sr.width),
      svgH: Math.round(sr.height),
      n: opts.length,
      opts: opts
    };
  });
  if (play.mode !== 'digi2ana' || play.digital !== '6:15' || play.prompt.indexOf('Welke klok') === -1) {
    console.error('FAIL play state', play);
    await browser.close();
    process.exit(1);
  }
  if (play.svgText.indexOf('6:15') === -1 || play.svgW < 120) {
    console.error('FAIL digital stimulus', play);
    await browser.close();
    process.exit(1);
  }
  if (play.n !== 3 || play.opts.filter(function (o) { return o.hasSvg && o.w > 40 && o.hgt > 40; }).length !== 3) {
    console.error('FAIL analog options', play);
    await browser.close();
    process.exit(1);
  }
  if (!play.opts.some(function (o) { return o.h === '6' && o.m === '15' && o.ok === '1'; })) {
    console.error('FAIL missing correct option', play);
    await browser.close();
    process.exit(1);
  }
  ok('scherm: wekkerradio 6:15 en drie analoge klokken');

  await page.screenshot({ path: SHOT + '/53-tijd-digitaal.png' });
  ok('screenshot 53-tijd-digitaal.png');

  var wrongSel = '#tijd-choices .tijd-choice:not([data-ok="1"])';
  await page.click(wrongSel);
  await wait(200);
  const afterWrong = await page.evaluate(function () {
    return { hasWrong: !!document.querySelector('#tijd-choices .tijd-choice.is-wrong') };
  });
  if (!afterWrong.hasWrong) {
    console.error('FAIL wrong tap', afterWrong);
    await browser.close();
    process.exit(1);
  }
  ok('fout tik markeert het knopje');

  await page.click('#tijd-choices .tijd-choice[data-ok="1"]');
  await wait(200);
  const afterOk = await page.evaluate(function () {
    var el = document.querySelector('#tijd-choices .tijd-choice.is-correct');
    return { hasGood: !!el, h: el ? el.getAttribute('data-h') : '', m: el ? el.getAttribute('data-m') : '' };
  });
  if (!afterOk.hasGood || afterOk.h !== '6' || afterOk.m !== '15') {
    console.error('FAIL correct tap', afterOk);
    await browser.close();
    process.exit(1);
  }
  ok('goed tik markeert de juiste klok');

  await page.evaluate(function () {
    window.__tijdTest.startDigi('kwart', true, { h: 6, m: 15, mode: 'ana2digi' });
  });
  await wait(250);
  const rev = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var prompt = document.getElementById('tijd-prompt');
    var btns = document.querySelectorAll('#tijd-choices .tijd-choice');
    var clock = document.getElementById('tijd-clock');
    var i, digits = [];
    for (i = 0; i < btns.length; i++) digits.push((btns[i].textContent || '').replace(/\s+/g, ''));
    return {
      mode: stage ? stage.getAttribute('data-mode') : '',
      prompt: prompt ? prompt.textContent : '',
      hasAnalog: !!(clock && clock.querySelector('line')),
      digits: digits,
      n: btns.length
    };
  });
  if (rev.mode !== 'ana2digi' || rev.prompt.indexOf('Welke tijd') === -1 || !rev.hasAnalog || rev.n !== 3) {
    console.error('FAIL reverse mode', rev);
    await browser.close();
    process.exit(1);
  }
  if (rev.digits.indexOf('6:15') === -1) {
    console.error('FAIL reverse missing 6:15', rev);
    await browser.close();
    process.exit(1);
  }
  ok('omgekeerd: analoge klok met drie digitale tijden');

  if (failed) {
    await browser.close();
    process.exit(1);
  }
  console.log('ALL TIJD DIGI CHECKS OK');
  await browser.close();
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
