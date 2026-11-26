/**
 * Zeeën rond Europa as Waar ligt…?: all 13 seas, Med visible, generous small-sea hits.
 *   NODE_PATH=... node test/topo-zeeen.js
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
    if (!t || !t.zeeen || !t.waarHit || !t.startWaar) {
      out.push('FAIL no __topoTest zee/waar hooks');
      return out;
    }
    t.startWaar('hard', true, 'zee');
    var i, o, hit, need, byId = {}, prompt, audio, svg, stroke, ids, unique;
    need = {
      noordzee: 'Noordzee',
      oostzee: 'Oostzee',
      med: 'Middellandse Zee',
      zwart: 'Zwarte Zee',
      atl: 'Atlantische Oceaan',
      noors: 'Noorse Zee',
      barents: 'Barentszzee',
      adria: 'Adriatische Zee',
      biskaje: 'Golf van Biskaje',
      kanaal: 'Het Kanaal',
      iers: 'Ierse Zee',
      egeisch: 'Egeïsche Zee',
      kaspisch: 'Kaspische Zee'
    };
    assert(t.zeeen.length === 13, '13 zeeën (kreeg ' + t.zeeen.length + ')');
    assert(t.zeeVbW >= 1000 && t.zeeVbH >= 700, 'zee-viewBox ' + t.zeeVbW + 'x' + t.zeeVbH);
    for (i = 0; i < t.zeeen.length; i++) {
      o = t.zeeen[i];
      byId[o.id] = o;
      assert(!!need[o.id], o.id + ' is een bekende zee');
      assert(o.name === need[o.id], o.id + ' heet ' + o.name);
      assert(!!o.path && o.path.charAt(0) === 'M', o.id + ' heeft pad');
      prompt = t.waarPrompt(o);
      if (o.id === 'kanaal') {
        assert(prompt === 'Waar ligt het Kanaal?', 'Kanaal-prompt: ' + prompt);
      } else {
        assert(prompt === 'Waar ligt de ' + o.name + '?', o.id + ' prompt: ' + prompt);
      }
      audio = t.waarAudio(o);
      if (o.id === 'kanaal') {
        assert(audio === 'waar-ligt-het-kanaal', 'Kanaal-audio ' + audio);
      } else {
        assert(audio && audio.indexOf('waar-ligt-de-') === 0, o.id + ' audio ' + audio);
      }
      hit = t.waarHit(o.cx, o.cy, 'hard');
      assert(hit && hit.id === o.id, o.id + ' hit op eigen anker, niet ' + (hit && hit.id));
      hit = t.waarHit(o.cx + 3000, o.cy + 3000, 'hard');
      assert(!hit, o.id + ' geen hit ver weg');
    }
    assert(!!byId.med, 'Middellandse Zee zit in het spel');
    assert(byId.med.w >= 400 && byId.med.h >= 150, 'Middellandse Zee is een groot vlak (' + byId.med.w + 'x' + byId.med.h + ')');
    hit = t.waarHit(byId.med.cx, byId.med.cy, 'hard');
    assert(hit && hit.id === 'med', 'Middellandse Zee is tikkbaar op haar anker');

    // Small seas keep their own generous zone and do not steal the big neighbours at their anchors
    hit = t.waarHit(byId.kanaal.cx, byId.kanaal.cy, 'hard');
    assert(hit && hit.id === 'kanaal', 'Kanaal-anker blijft Het Kanaal, niet ' + (hit && hit.id));
    hit = t.waarHit(byId.kanaal.cx, byId.kanaal.cy - 30, 'hard');
    assert(hit && hit.id === 'kanaal', 'ruimere zone rond Het Kanaal (kreeg ' + (hit && hit.id) + ')');
    hit = t.waarHit(byId.iers.cx, byId.iers.cy, 'hard');
    assert(hit && hit.id === 'iers', 'Ierse Zee-anker blijft Ierse Zee, niet ' + (hit && hit.id));
    hit = t.waarHit(byId.iers.cx + 20, byId.iers.cy, 'hard');
    assert(hit && hit.id === 'iers', 'ruimere zone rond de Ierse Zee (kreeg ' + (hit && hit.id) + ')');
    hit = t.waarHit(byId.noordzee.cx, byId.noordzee.cy, 'hard');
    assert(hit && hit.id === 'noordzee', 'Noordzee-anker blijft Noordzee, niet ' + (hit && hit.id));

    svg = document.getElementById('topo-waar-svg');
    assert(!!svg, 'zeeënkaart is getekend');
    stroke = 0;
    if (svg) {
      var paths = svg.querySelectorAll('path[data-topo-id]');
      for (i = 0; i < paths.length; i++) {
        if (paths[i].getAttribute('stroke') && paths[i].getAttribute('stroke') !== 'none') stroke += 1;
      }
      assert(paths.length === 13, '13 zeevlakken (kreeg ' + paths.length + ')');
      assert(!!svg.querySelector('path[data-topo-id="med"]'), 'Middellandse Zee staat op de kaart');
    }
    assert(stroke === 0, 'geen belijning op zeevlakken (kreeg ' + stroke + ')');

    // Every sea appears across rounds (13 unique questions)
    t.getState().used = [];
    t.getState().found = {};
    t.startWaar('hard', true, 'zee');
    ids = [t.getState().q.id];
    for (i = 0; i < 12; i++) {
      t.startWaar('hard', false, 'zee');
      ids.push(t.getState().q.id);
    }
    unique = {};
    for (i = 0; i < ids.length; i++) unique[ids[i]] = 1;
    assert(ids.length === 13 && Object.keys(unique).length === 13, 'alle 13 zeeën komen in de ronden voor (' + ids.join(',') + ')');
    assert(unique.med, 'Middellandse Zee komt in de vragen voor');

    t.startWaar('hard', true, 'zee');
    var qid = t.getState().q.id;
    var q = byId[qid], other = byId[qid === 'med' ? 'noordzee' : 'med'];
    t.waarTap(other);
    assert(t.getState().misses === 1 && !t.getState().hintId, 'na 1 fout: geen hint');
    t.waarTap(other);
    assert(t.getState().misses === 2 && t.getState().hintId === qid, 'na 2 fouten knippert het goede antwoord');
    t.waarTap(q);
    assert(t.getState().found && t.getState().found[qid], 'goed tik markeert ' + qid);
    var texts = document.querySelectorAll('#topo-waar-svg text');
    var foundName = false;
    for (i = 0; i < texts.length; i++) {
      if (texts[i].textContent === q.name) foundName = true;
    }
    assert(foundName, 'naam blijft op de kaart staan (' + q.name + ')');
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.click('#btn-goto-topo');
  await page.waitForSelector('#topo-grid [data-game="zee"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="zee"]');
  try {
    await page.waitForSelector('#screen-topowaar:not(.is-hidden)', { timeout: 8000 });
    ok('Zeeën rond Europa start direct als Waar ligt…?, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Zeeën start niet op het Waar-ligt-scherm');
    failed += 1;
  }
  var prompt = await page.$eval('#topo-waar-prompt', function (el) { return el.textContent; });
  if (prompt.indexOf('Waar ligt') !== 0) {
    console.log('FAIL speel-prompt was ' + prompt);
    failed += 1;
  } else {
    ok('speel-prompt: ' + prompt);
  }
  var hasMed = await page.evaluate(function () {
    return !!document.querySelector('#topo-waar-svg path[data-topo-id="med"]');
  });
  if (!hasMed) {
    console.log('FAIL Middellandse Zee ontbreekt op de kaart');
    failed += 1;
  } else {
    ok('Middellandse Zee staat op de kaart');
  }

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL ZEEEN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
