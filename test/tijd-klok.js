/**
 * Phrasing + smoke checks for Tijd / Klok kijken.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/tijd-klok.js
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
    if (!t) {
      out.push('FAIL no __tijdTest');
      return out;
    }
    eq(t.format(1, 0), 'één uur', 'één uur');
    eq(t.format(6, 0), 'zes uur', 'zes uur');
    eq(t.format(12, 0), 'twaalf uur', 'twaalf uur');
    eq(t.format(6, 15), 'kwart over zes', 'kwart over zes');
    eq(t.format(6, 30), 'half zeven', 'half zeven = 6:30');
    eq(t.format(6, 45), 'kwart voor zeven', 'kwart voor zeven');
    eq(t.format(6, 5), 'vijf over zes', 'vijf over zes');
    eq(t.format(6, 10), 'tien over zes', 'tien over zes');
    eq(t.format(6, 20), 'tien voor half zeven', 'tien voor half zeven = 6:20');
    eq(t.format(6, 25), 'vijf voor half zeven', 'vijf voor half zeven = 6:25');
    eq(t.format(6, 35), 'vijf over half zeven', 'vijf over half zeven = 6:35');
    eq(t.format(6, 40), 'tien over half zeven', 'tien over half zeven = 6:40');
    eq(t.format(6, 50), 'tien voor zeven', 'tien voor zeven');
    eq(t.format(6, 55), 'vijf voor zeven', 'vijf voor zeven');
    eq(t.format(12, 30), 'half één', 'half één = 12:30');
    eq(t.format(12, 20), 'tien voor half één', 'tien voor half één');
    eq(t.format(12, 45), 'kwart voor één', 'kwart voor één');
    eq(t.format(11, 30), 'half twaalf', 'half twaalf');
    eq(t.format(1, 30), 'half twee', 'half twee');
    eq(t.format(5, 45), 'kwart voor zes', 'kwart voor zes');
    eq(t.format(0, 0), 'twaalf uur', 'hour 0 → twaalf uur');

    var kinds = ['hele', 'halve', 'kwart', 'vijf'];
    var expectN = { hele: 12, halve: 12, kwart: 48, vijf: 144 };
    var k, kind, pool, i, seen, key, h, m, phrase, n;
    for (k = 0; k < kinds.length; k++) {
      kind = kinds[k];
      pool = t.pool(kind);
      seen = {};
      for (i = 0; i < pool.length; i++) {
        h = pool[i].h;
        m = pool[i].m;
        key = h + '-' + m;
        if (seen[key]) out.push('FAIL ' + kind + ' duplicate ' + key);
        seen[key] = 1;
        phrase = t.format(h, m);
        if (!phrase) out.push('FAIL ' + kind + ' empty phrase ' + key);
        if (kind === 'hele' && m !== 0) out.push('FAIL hele has m=' + m);
        if (kind === 'halve' && m !== 30) out.push('FAIL halve has m=' + m);
        if (kind === 'kwart' && m % 15 !== 0) out.push('FAIL kwart has m=' + m);
        if (kind === 'vijf' && m % 5 !== 0) out.push('FAIL vijf has m=' + m);
      }
      n = pool.length;
      eq(n, expectN[kind], kind + ' pool size');
    }

    t.start('hele', true);
    var st = t.state();
    assert(!!st && !!st.phrase && st.options && st.options.length === 3, 'startKlok returns 3 options');
    assert(st.options.indexOf(st.phrase) !== -1, 'correct phrase among options');
    return out;
  });

  var failed = 0;
  var i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  if (failed) {
    console.error('UNIT FAILED', failed);
    await browser.close();
    process.exit(1);
  }
  ok('Nederlandse tijdfrasen en pools');

  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await wait(200);

  const layout = await page.evaluate(function () {
    var grid = document.getElementById('choice-grid');
    var btns = grid ? grid.querySelectorAll('.choice-btn') : [];
    var i, r, rows = {}, labels = [];
    for (i = 0; i < btns.length; i++) {
      r = btns[i].getBoundingClientRect();
      labels.push({
        label: (btns[i].querySelector('.choice-label') || {}).textContent,
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height)
      });
    }
    return { n: btns.length, className: grid ? grid.className : '', labels: labels };
  });
  if (layout.n !== 9) {
    console.error('FAIL expected 9 start tabs, got', layout.n, layout);
    await browser.close();
    process.exit(1);
  }
  if (layout.className.indexOf('choices-9') === -1) {
    console.error('FAIL choice-grid not choices-9', layout.className);
    await browser.close();
    process.exit(1);
  }
  var hidden = layout.labels.filter(function (b) { return b.w < 40 || b.h < 40; });
  if (hidden.length) {
    console.error('FAIL start tabs too small', hidden);
    await browser.close();
    process.exit(1);
  }
  var names = layout.labels.map(function (b) { return b.label; }).join(',');
  if (names.indexOf('Tijd') === -1) {
    console.error('FAIL Tijd tab missing', names);
    await browser.close();
    process.exit(1);
  }
  ok('9 starttabs zichtbaar in 3x3 (' + names + ')');

  await page.screenshot({ path: SHOT + '/53-tijd-start.png' });
  ok('screenshot 53-tijd-start.png');

  await page.click('#btn-goto-tijd');
  await wait(250);
  await page.click('#tijd-grid [data-game="klok"]');
  await wait(250);
  await page.click('#tijdlevel-grid [data-kind="kwart"]');
  await wait(400);

  const play = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var clock = document.getElementById('tijd-clock');
    var btns = document.querySelectorAll('#tijd-choices .tijd-choice');
    var r, i, options = [], svg;
    svg = clock ? clock.querySelector('svg') : null;
    for (i = 0; i < btns.length; i++) {
      r = btns[i].getBoundingClientRect();
      options.push({
        phrase: btns[i].getAttribute('data-phrase'),
        text: btns[i].textContent,
        w: Math.round(r.width), h: Math.round(r.height)
      });
    }
    return {
      screen: document.getElementById('screen-tijdplay') && document.getElementById('screen-tijdplay').className,
      h: stage ? stage.getAttribute('data-h') : null,
      m: stage ? stage.getAttribute('data-m') : null,
      phrase: stage ? stage.getAttribute('data-phrase') : null,
      kind: stage ? stage.getAttribute('data-kind') : null,
      hasSvg: !!(svg),
      svgW: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
      svgH: svg ? Math.round(svg.getBoundingClientRect().height) : 0,
      options: options
    };
  });
  if (play.screen && play.screen.indexOf('is-hidden') !== -1) {
    console.error('FAIL tijdplay hidden', play);
    await browser.close();
    process.exit(1);
  }
  if (play.kind !== 'kwart' || !play.phrase || play.options.length !== 3) {
    console.error('FAIL play state', play);
    await browser.close();
    process.exit(1);
  }
  if (play.svgW < 120 || play.svgH < 120) {
    console.error('FAIL clock too small', play);
    await browser.close();
    process.exit(1);
  }
  var phrases = play.options.map(function (o) { return o.phrase; });
  if (phrases.indexOf(play.phrase) === -1) {
    console.error('FAIL correct option missing', play);
    await browser.close();
    process.exit(1);
  }
  ok('Klok kijken kwartieren: ' + play.phrase + ' (klok ' + play.h + ':' + ('0' + play.m).slice(-2) + ')');

  await page.screenshot({ path: SHOT + '/53-tijd-klok.png' });
  ok('screenshot 53-tijd-klok.png');

  var wrongSel = '#tijd-choices .tijd-choice:not([data-phrase="' + play.phrase.replace(/"/g, '\\"') + '"])';
  await page.click(wrongSel);
  await wait(200);
  const afterWrong = await page.evaluate(function () {
    var wrong = document.querySelector('#tijd-choices .tijd-choice.is-wrong');
    var locked = false;
    try { locked = !!(window.state && window.state.locked); } catch (e) {}
    return { hasWrong: !!wrong, locked: locked };
  });
  if (!afterWrong.hasWrong) {
    console.error('FAIL wrong tap did not mark button', afterWrong);
    await browser.close();
    process.exit(1);
  }
  ok('fout tik markeert het knopje');

  await page.click('#tijd-choices .tijd-choice[data-phrase="' + play.phrase.replace(/"/g, '\\"') + '"]');
  await wait(200);
  const afterOk = await page.evaluate(function () {
    var good = document.querySelector('#tijd-choices .tijd-choice.is-correct');
    return { hasGood: !!good, text: good ? good.textContent : '' };
  });
  if (!afterOk.hasGood) {
    console.error('FAIL correct tap not marked', afterOk);
    await browser.close();
    process.exit(1);
  }
  ok('goed tik markeert het juiste antwoord');

  if (failed) {
    await browser.close();
    process.exit(1);
  }
  console.log('ALL TIJD KLOK CHECKS OK');
  await browser.close();
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
