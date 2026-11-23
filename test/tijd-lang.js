/**
 * Checks for Tijd / Hoe lang is…?
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/tijd-lang.js
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
    if (!t || !t.startLang || !t.LANG_Q) {
      out.push('FAIL no __tijdTest.startLang');
      return out;
    }
    var easy = t.langPool('easy');
    var hard = t.langPool('hard');
    eq(easy.length, 9, 'makkelijk 9 vragen');
    eq(hard.length, t.LANG_Q.length, 'moeilijk is alles');
    assert(hard.length > easy.length, 'moeilijk is groter dan makkelijk');
    var ids = {}, i, q, hasAns;
    for (i = 0; i < t.LANG_Q.length; i++) {
      q = t.LANG_Q[i];
      if (ids[q.id]) out.push('FAIL dubbel id ' + q.id);
      ids[q.id] = 1;
      hasAns = q.options.indexOf(q.answer) !== -1;
      assert(hasAns, q.id + ' bevat het antwoord');
      assert(q.options.length >= 3 && q.options.length <= 4, q.id + ' heeft 3 of 4 opties');
    }
    var need = ['minuut', 'uur', 'dag', 'week', 'jaar-maand', 'jaar-week', 'jaar-dag', 'l-mu', 'k-dw'];
    for (i = 0; i < need.length; i++) assert(!!t.langFind(need[i]), 'vraag ' + need[i]);
    eq(t.langFind('week').answer, '7 dagen', 'week = 7 dagen');
    eq(t.langFind('uur').answer, '60 minuten', 'uur = 60 minuten');
    eq(t.langFind('dag').answer, '24 uur', 'dag = 24 uur');
    eq(t.langFind('minuut').answer, '60 seconden', 'minuut = 60 seconden');
    eq(t.langFind('jaar-maand').answer, '12', 'jaar heeft 12 maanden');
    eq(t.langFind('jaar-week').answer, '52', 'jaar heeft 52 weken');
    eq(t.langFind('jaar-dag').answer, '365', 'jaar heeft 365 dagen');
    eq(t.langFind('l-mu').answer, 'een uur', 'uur duurt langer dan minuut');
    eq(t.langFind('k-dw').answer, 'een dag', 'dag is korter dan week');
    assert(t.langFind('minuut').easy === 0, 'seconden-vraag is moeilijk');
    assert(t.langFind('uur').easy === 1, 'uren-vraag is makkelijk');
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
  ok('feiten, vergelijkingen en niveaus');

  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await wait(200);
  await page.evaluate(function () {
    window.__tijdTest.startLang('easy', true, 'dag');
  });
  await wait(250);

  const play = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var clock = document.getElementById('tijd-clock');
    var svg = clock ? clock.querySelector('svg') : null;
    var prompt = document.getElementById('tijd-prompt');
    var btns = document.querySelectorAll('#tijd-choices .tijd-choice');
    var sr = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
    var i, opts = [], r;
    for (i = 0; i < btns.length; i++) {
      r = btns[i].getBoundingClientRect();
      opts.push({
        val: btns[i].getAttribute('data-value'),
        ok: btns[i].getAttribute('data-ok'),
        w: Math.round(r.width),
        h: Math.round(r.height),
        text: (btns[i].textContent || '').replace(/\s+/g, ' ').trim()
      });
    }
    return {
      className: stage ? stage.className : '',
      id: stage ? stage.getAttribute('data-id') : '',
      answer: stage ? stage.getAttribute('data-answer') : '',
      vis: stage ? stage.getAttribute('data-vis') : '',
      prompt: prompt ? prompt.textContent : '',
      svgW: Math.round(sr.width),
      svgH: Math.round(sr.height),
      n: opts.length,
      opts: opts
    };
  });
  if (play.id !== 'dag' || play.answer !== '24 uur' || play.prompt.indexOf('Hoe lang is een dag') === -1) {
    console.error('FAIL play state', play);
    await browser.close();
    process.exit(1);
  }
  if (play.n !== 4 || play.svgW < 100 || play.svgH < 80) {
    console.error('FAIL layout', play);
    await browser.close();
    process.exit(1);
  }
  if (!play.opts.some(function (o) { return o.val === '24 uur' && o.ok === '1' && o.w > 40 && o.h > 40; })) {
    console.error('FAIL missing 24 uur button', play);
    await browser.close();
    process.exit(1);
  }
  ok('scherm: Hoe lang is een dag? met 4 knoppen');

  await page.screenshot({ path: SHOT + '/53-tijd-hoelang.png' });
  ok('screenshot 53-tijd-hoelang.png');

  await page.click('#tijd-choices .tijd-choice:not([data-ok="1"])');
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
    return { hasGood: !!el, val: el ? el.getAttribute('data-value') : '' };
  });
  if (!afterOk.hasGood || afterOk.val !== '24 uur') {
    console.error('FAIL correct tap', afterOk);
    await browser.close();
    process.exit(1);
  }
  ok('goed tik markeert 24 uur');

  await page.evaluate(function () {
    window.__tijdTest.startLang('easy', true, 'l-mu');
  });
  await wait(200);
  const cmp = await page.evaluate(function () {
    var stage = document.getElementById('tijd-stage');
    var btns = document.querySelectorAll('#tijd-choices .tijd-choice');
    return {
      id: stage ? stage.getAttribute('data-id') : '',
      n: btns.length,
      hasUur: !!document.querySelector('#tijd-choices [data-value="een uur"]'),
      hasEven: !!document.querySelector('#tijd-choices [data-value="even lang"]')
    };
  });
  if (cmp.id !== 'l-mu' || cmp.n !== 3 || !cmp.hasUur || !cmp.hasEven) {
    console.error('FAIL comparison', cmp);
    await browser.close();
    process.exit(1);
  }
  ok('vergelijking: drie knoppen inclusief even lang');

  if (failed) {
    await browser.close();
    process.exit(1);
  }
  console.log('ALL TIJD LANG CHECKS OK');
  await browser.close();
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
