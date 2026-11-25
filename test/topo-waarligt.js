/**
 * Waar ligt…? (Europa): pools, prompts, hit-test, misses and no repeats.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=... node test/topo-waarligt.js
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
    if (!t || !t.waarHit || !t.startWaar) {
      out.push('FAIL no __topoTest.waar hooks');
      return out;
    }
    var easy = t.idsWhere('easyP');
    var hard = t.idsWhere('hardP');
    assert(easy.length === 8, 'makkelijk heeft ' + easy.length + ' landen (8)');
    assert(hard.length === 25, 'moeilijk heeft ' + hard.length + ' landen (25)');
    var need = ['nl', 'be', 'de', 'fr', 'es', 'it', 'gb', 'pl'];
    var i, id, land, hit, prompt, audio, other;
    for (i = 0; i < need.length; i++) {
      assert(easy.indexOf(need[i]) !== -1, 'makkelijk bevat ' + need[i]);
    }
    for (i = 0; i < hard.length; i++) {
      land = t.landById(hard[i]);
      assert(land && land.path && land.path.charAt(0) === 'M', hard[i] + ' heeft pad');
      audio = t.waarAudio(land);
      assert(audio && audio.indexOf('waar-ligt-') === 0, hard[i] + ' audio ' + audio);
      prompt = t.waarPrompt(land);
      if (land.id === 'gb') {
        assert(prompt === 'Waar ligt het Verenigd Koninkrijk?', 'VK-prompt: ' + prompt);
      } else {
        assert(prompt === 'Waar ligt ' + land.name + '?', land.id + ' prompt: ' + prompt);
      }
    }
    land = t.landById('fr');
    hit = t.waarHit(land.cx, land.cy, 'easy');
    assert(hit && hit.id === 'fr', 'centroid Frankrijk kiest fr, niet ' + (hit && hit.id));
    hit = t.waarHit(-200, -200, 'easy');
    assert(!hit, 'ver weg geen land');
    assert(t.waarShouldHint(0) === false, '0 missers: geen hint');
    assert(t.waarShouldHint(1) === false, '1 misser: geen hint');
    assert(t.waarShouldHint(2) === true, '2 missers: wel hint');
    assert(t.waarShouldHint(3) === true, '3 missers: nog steeds hint');

    t.startWaar('easy', true);
    var first = t.getState().q && t.getState().q.id;
    assert(!!first, 'start zet een vraag (' + first + ')');
    var used = (t.getState().used || []).slice();
    var ids = [first];
    for (i = 0; i < 4; i++) {
      t.startWaar('easy', false);
      id = t.getState().q && t.getState().q.id;
      ids.push(id);
    }
    var unique = {};
    for (i = 0; i < ids.length; i++) unique[ids[i]] = 1;
    assert(ids.length === 5 && Object.keys(unique).length === 5, 'ronde van 5 zonder herhaling (' + ids.join(',') + ')');

    t.startWaar('easy', true);
    var qid = t.getState().q.id;
    var q = t.landById(qid);
    other = null;
    for (i = 0; i < easy.length; i++) {
      if (easy[i] !== qid) { other = t.landById(easy[i]); break; }
    }
    t.waarTap(other);
    assert(t.getState().misses === 1, 'na 1 fout: misses=1 (kreeg ' + t.getState().misses + ')');
    assert(!t.getState().hintId, 'na 1 fout: juiste land knippert nog niet');
    assert(t.getState().wrongId === other.id, 'na 1 fout: ' + other.id + ' is rood');
    var fill = document.querySelector('#topo-waar-svg path[data-topo-id="' + other.id + '"]');
    assert(fill && fill.getAttribute('fill') === '#E53935', 'fout land is rood');
    t.waarTap(other);
    assert(t.getState().misses === 2, 'na 2 fouten: misses=2');
    assert(t.getState().hintId === qid, 'na 2 fouten: juiste land knippert (' + qid + ')');
    fill = document.querySelector('#topo-waar-svg path[data-topo-id="' + qid + '"]');
    assert(fill, 'juiste land zit op de kaart voor de hint');

    t.waarTap(q);
    assert(t.getState().found && t.getState().found[qid], 'goed tik markeert ' + qid + ' als gevonden');
    fill = document.querySelector('#topo-waar-svg path[data-topo-id="' + qid + '"]');
    assert(fill && fill.getAttribute('fill') === '#43A047', 'goed land wordt groen');
    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await page.click('#btn-goto-topo');
  await page.waitForSelector('#topo-grid [data-game="waar"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="waar"]');
  await page.waitForSelector('#topolevel-grid [data-kind="easy"]', { timeout: 8000 });
  var title = await page.$eval('#topolevel-prompt', function (el) { return el.textContent; });
  if (title.indexOf('Waar ligt') === -1) {
    console.log('FAIL niveautitel was ' + title);
    failed += 1;
  } else {
    ok('niveautitel: ' + title);
  }
  await page.click('#topolevel-grid [data-kind="easy"]');
  await page.waitForSelector('#screen-topowaar:not(.is-hidden)', { timeout: 8000 });
  var prompt = await page.$eval('#topo-waar-prompt', function (el) { return el.textContent; });
  if (prompt.indexOf('Waar ligt') !== 0) {
    console.log('FAIL speel-prompt was ' + prompt);
    failed += 1;
  } else {
    ok('speel-prompt: ' + prompt);
  }
  var nPaths = await page.$$eval('#topo-waar-svg path[data-topo-id]', function (els) { return els.length; });
  if (nPaths < 30) {
    console.log('FAIL kaart heeft ' + nPaths + ' landen');
    failed += 1;
  } else {
    ok('kaart toont ' + nPaths + ' landen');
  }

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL TOPO WAAR LIGT CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
