/**
 * Oceanen as Waar ligt…?: data, prompts, hit-test, labels and no repeats.
 *   NODE_PATH=... node test/topo-oceanen.js
 */
const puppeteer = require('puppeteer-core');

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';

function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });

  const report = await page.evaluate(function () {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t || !t.oceanen || !t.waarHit || !t.startWaar) {
      out.push('FAIL no __topoTest ocean/waar hooks');
      return out;
    }
    t.startWaar('hard', true, 'ocean');
    var i, o, hit, need, names = {}, prompt, audio, svg, stroke;
    need = {
      pacific: 'Stille Oceaan',
      atlantic: 'Atlantische Oceaan',
      indian: 'Indische Oceaan',
      arctic: 'Noordelijke IJszee',
      southern: 'Zuidelijke Oceaan'
    };
    assert(t.oceanen.length === 5, '5 oceanen (kreeg ' + t.oceanen.length + ')');
    assert(t.oceanVbW === 1100 && t.oceanVbH === 574, 'wereld-viewBox ' + t.oceanVbW + 'x' + t.oceanVbH);
    for (i = 0; i < t.oceanen.length; i++) {
      o = t.oceanen[i];
      names[o.id] = o.name;
      assert(!!need[o.id], o.id + ' is een bekende oceaan');
      assert(o.name === need[o.id], o.id + ' heet ' + o.name);
      assert(!!o.path && o.path.charAt(0) === 'M', o.id + ' heeft pad');
      prompt = t.waarPrompt(o);
      assert(prompt === 'Waar ligt de ' + o.name + '?', o.id + ' prompt: ' + prompt);
      audio = t.waarAudio(o);
      assert(audio && audio.indexOf('waar-ligt-de-') === 0, o.id + ' audio ' + audio);
      hit = t.waarHit(o.cx, o.cy, 'hard');
      assert(hit && hit.id === o.id, o.id + ' hit op eigen anker, niet ' + (hit && hit.id));
      if (o.cx2 != null && (o.cx2 !== o.cx || o.cy2 !== o.cy)) {
        hit = t.waarHit(o.cx2, o.cy2, 'hard');
        assert(hit && hit.id === o.id, o.id + ' hit op tweede anker, niet ' + (hit && hit.id));
      }
      hit = t.waarHit(o.cx + 3000, o.cy + 3000, 'hard');
      assert(!hit, o.id + ' geen hit ver weg');
    }
    svg = document.getElementById('topo-waar-svg');
    assert(!!svg, 'oceaan-kaart is getekend');
    stroke = 0;
    var visible = 0, paths;
    if (svg) {
      paths = svg.querySelectorAll('path[data-topo-id]');
      for (i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute('stroke') && paths[i].getAttribute('stroke') !== 'none') stroke += 1;
        if (paths[i].getAttribute('fill-opacity') !== '0' || paths[i].getAttribute('opacity') !== '0') visible += 1;
        assert(paths[i].getAttribute('fill') && paths[i].getAttribute('fill') !== 'none', paths[i].getAttribute('data-topo-id') + ' heeft een fill (niet none)');
        assert(paths[i].getAttribute('fill') === t.seaColor, paths[i].getAttribute('data-topo-id') + ' fill is zeekleur');
        assert(paths[i].getAttribute('opacity') === '0', paths[i].getAttribute('data-topo-id') + ' opacity=0');
        assert((' ' + (paths[i].getAttribute('class') || '') + ' ').indexOf(' topo-waar-hit-inv ') !== -1, paths[i].getAttribute('data-topo-id') + ' heeft hit-inv class');
      }
      assert(paths.length === 5, '5 onzichtbare tikzones (kreeg ' + paths.length + ')');
    }
    assert(stroke === 0, 'geen belijning op oceaanvlakken (kreeg ' + stroke + ')');
    assert(visible === 0, 'verse ronde toont geen zeevakken (zichtbaar: ' + visible + ')');

    var ids = [];
    var unique = {};
    t.getState().used = [];
    t.getState().found = {};
    t.startWaar('hard', true, 'ocean');
    ids.push(t.getState().q.id);
    for (i = 0; i < 4; i++) {
      t.startWaar('hard', false, 'ocean');
      ids.push(t.getState().q.id);
    }
    for (i = 0; i < ids.length; i++) unique[ids[i]] = 1;
    assert(ids.length === 5 && Object.keys(unique).length === 5, 'ronde van 5 zonder herhaling (' + ids.join(',') + ')');
    assert(Object.keys(unique).length === 5, 'alle 5 oceanen komen in de ronden voor');

    t.startWaar('hard', true, 'ocean');
    var qid = t.getState().q.id;
    var q = null, other = null;
    for (i = 0; i < t.oceanen.length; i++) {
      if (t.oceanen[i].id === qid) q = t.oceanen[i];
      else if (!other) other = t.oceanen[i];
    }
    t.waarTap(other);
    assert(t.getState().misses === 1, 'na 1 fout: misses=1');
    assert(!t.getState().hintId, 'na 1 fout: geen hint');
    var wrongPath = document.querySelector('#topo-waar-svg path[data-topo-id="' + other.id + '"]');
    assert(wrongPath && wrongPath.getAttribute('fill-opacity') === '0', 'foute tik onthult geen zeevak');
    t.waarTap(other);
    assert(t.getState().misses === 2 && t.getState().hintId === qid, 'na 2 fouten knippert het goede antwoord');
    t.waarTap(q);
    assert(t.getState().found && t.getState().found[qid], 'goed tik markeert ' + qid);
    var goodPath = document.querySelector('#topo-waar-svg path[data-topo-id="' + qid + '"]');
    assert(goodPath && parseFloat(goodPath.getAttribute('fill-opacity')) > 0, 'goed antwoord krijgt een zachte highlight');
    var label = document.querySelector('#topo-waar-svg text');
    assert(label && label.textContent === q.name, 'naam blijft op de kaart staan (' + (label && label.textContent) + ')');
    var promptEl = document.getElementById('topo-waar-prompt');
    assert(promptEl && promptEl.textContent.indexOf('Waar ligt de ') === 0, 'prompt: ' + (promptEl && promptEl.textContent));
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.click('#btn-goto-topo');
  await page.waitForSelector('#topo-grid [data-game="ocean"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="ocean"]');
  try {
    await page.waitForSelector('#screen-topowaar:not(.is-hidden)', { timeout: 8000 });
    ok('Oceanen start direct als Waar ligt…?, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Oceanen start niet op het Waar-ligt-scherm');
    failed += 1;
  }
  var levelOpen = await page.evaluate(function () {
    var el = document.getElementById('screen-topolevel');
    return el && (' ' + el.className + ' ').indexOf(' is-hidden ') === -1;
  });
  if (levelOpen) {
    console.log('FAIL Oceanen toont een niveaukiezer');
    failed += 1;
  }
  var prompt = await page.$eval('#topo-waar-prompt', function (el) { return el.textContent; });
  if (prompt.indexOf('Waar ligt') !== 0) {
    console.log('FAIL speel-prompt was ' + prompt);
    failed += 1;
  } else {
    ok('speel-prompt: ' + prompt);
  }
  var tray = await page.$('#topo-drop-tray');
  var trayVisible = await page.evaluate(function () {
    var el = document.getElementById('screen-topodrop');
    return el && (' ' + el.className + ' ').indexOf('is-hidden') === -1;
  });
  if (trayVisible) {
    console.log('FAIL sleepbak is nog zichtbaar');
    failed += 1;
  } else {
    ok('geen sleepbak, alleen tikken op de kaart');
  }

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL OCEANEN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
