/**
 * Friesland: towns, Wadden islands, drop-hit and drag-follow.
 *   NODE_PATH=... node test/topo-friesland.js
 */
const puppeteer = require('puppeteer-core');

function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });
  const url = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
  const report = await page.evaluate(() => {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t || !t.friesland || !t.dropHit || !t.startDrop) {
      out.push('FAIL no __topoTest fries hooks');
      return out;
    }
    t.getState().game = 'fries';
    t.getState().placed = {};
    var i, o, hit, byId = {}, towns = 0, islands = 0, pre = 0;
    var elf = ['leeuwarden', 'sneek', 'ijlst', 'sloten', 'stavoren', 'hindeloopen', 'workum', 'bolsward', 'harlingen', 'franeker', 'dokkum'];
    var extra = ['goutum', 'heerenveen', 'drachten'];
    var wad = ['vlieland', 'terschelling', 'ameland', 'schiermonnikoog'];
    assert(t.friesland.length === 19, '19 plaatsen (11 steden + Goutum + Heerenveen + Drachten + 5 eilanden), kreeg ' + t.friesland.length);
    assert(t.friesVbW >= 800 && t.friesVbH >= 600, 'fries-viewBox ' + t.friesVbW + 'x' + t.friesVbH);
    for (i = 0; i < t.friesland.length; i++) {
      o = t.friesland[i];
      byId[o.id] = o;
      if (o.kind === 'stad') towns += 1;
      if (o.kind === 'eiland') islands += 1;
      if (o.pre) pre += 1;
      assert(!!o.name && !!o.audio, o.id + ' heeft naam en audio');
      assert(o.cx > 0 && o.cy > 0, o.id + ' heeft coördinaat');
    }
    assert(towns === 14, '14 steden/dorpen (kreeg ' + towns + ')');
    assert(islands === 5, '5 eilanden inclusief Texel (kreeg ' + islands + ')');
    assert(pre === 1 && byId.texel && byId.texel.pre, 'Texel is vooringevuld');
    for (i = 0; i < elf.length; i++) {
      assert(!!byId[elf[i]], 'elf steden bevat ' + elf[i]);
    }
    for (i = 0; i < extra.length; i++) {
      assert(!!byId[extra[i]], 'extra plaats ' + extra[i]);
    }
    for (i = 0; i < wad.length; i++) {
      assert(!!byId[wad[i]] && !byId[wad[i]].pre, wad[i] + ' is te plaatsen');
      assert(!!byId[wad[i]].path && byId[wad[i]].path.charAt(0) === 'M', wad[i] + ' heeft eilandpad');
    }
    assert(byId.leeuwarden.name === 'Leeuwarden' && byId.goutum.name === 'Goutum', 'Leeuwarden en Goutum');
    assert(byId.ijlst.name === 'IJlst', 'IJlst spelling');
    // Close neighbours must still resolve to the nearer dot
    hit = t.dropHit(byId.goutum.cx, byId.goutum.cy);
    assert(hit && hit.id === 'goutum', 'punt Goutum kiest Goutum, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.leeuwarden.cx, byId.leeuwarden.cy);
    assert(hit && hit.id === 'leeuwarden', 'punt Leeuwarden kiest Leeuwarden, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.ijlst.cx, byId.ijlst.cy);
    assert(hit && hit.id === 'ijlst', 'punt IJlst kiest IJlst, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.sneek.cx, byId.sneek.cy);
    assert(hit && hit.id === 'sneek', 'punt Sneek kiest Sneek, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.ameland.cx, byId.ameland.cy);
    assert(hit && hit.id === 'ameland', 'punt Ameland kiest Ameland, niet ' + (hit && hit.id));
    hit = t.dropHit(byId.texel.cx, byId.texel.cy);
    assert(!hit, 'Texel is geen dropdoel (hit ' + (hit && hit.id) + ')');
    // All placeable dots hit themselves
    for (i = 0; i < t.friesland.length; i++) {
      o = t.friesland[i];
      if (o.pre) continue;
      hit = t.dropHit(o.cx, o.cy);
      assert(hit && hit.id === o.id, o.id + ' hit op eigen punt, niet ' + (hit && hit.id));
    }
    return out;
  });

  async function ghostBox() {
    return page.evaluate(() => {
      var g = document.querySelector('.topo-label.is-ghost, .topo-ghost');
      if (!g) return null;
      var b = g.getBoundingClientRect();
      return { left: b.left, top: b.top };
    });
  }

  async function assertGhostFollowsTouch(sel, label) {
    var piece = await page.$(sel);
    if (!piece) throw new Error(label + ': label niet gevonden (' + sel + ')');
    var r = await piece.boundingBox();
    if (!r) throw new Error(label + ': geen bounding box');
    var x0 = r.x + r.width * 0.4;
    var y0 = r.y + r.height * 0.5;
    await page.touchscreen.touchStart(x0, y0);
    await new Promise(function (res) { setTimeout(res, 40); });
    var g1 = await ghostBox();
    if (!g1) {
      await page.touchscreen.touchEnd();
      throw new Error(label + ': geen sleepstuk na touchStart');
    }
    var dx = 90, dy = -50;
    await page.touchscreen.touchMove(x0 + dx, y0 + dy);
    await new Promise(function (res) { setTimeout(res, 40); });
    var g2 = await ghostBox();
    await page.touchscreen.touchEnd();
    if (!g2) throw new Error(label + ': geen sleepstuk na touchMove');
    var gotX = g2.left - g1.left;
    var gotY = g2.top - g1.top;
    if (Math.abs(gotX - dx) > 3 || Math.abs(gotY - dy) > 3) {
      throw new Error(label + ' volgt de vinger niet: dx=' + gotX.toFixed(1) + ' (wil ' + dx + '), dy=' + gotY.toFixed(1) + ' (wil ' + dy + ')');
    }
    ok(label + ' volgt de vinger (delta ' + Math.round(gotX) + ',' + Math.round(gotY) + ')');
  }

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  await page.click('#btn-goto-topo');
  await page.waitForSelector('#topo-grid [data-game="fries"]', { timeout: 8000 });
  await page.click('#topo-grid [data-game="fries"]');
  try {
    await page.waitForSelector('#screen-topodrop:not(.is-hidden)', { timeout: 8000 });
    ok('Friesland start direct, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Friesland start niet direct');
    failed += 1;
  }
  var hasTexel = await page.evaluate(function () {
    var wrap = document.getElementById('topo-drop-map-wrap');
    return !!(wrap && wrap.textContent && wrap.textContent.indexOf('Texel') !== -1);
  });
  if (!hasTexel) {
    console.log('FAIL Texel staat niet vooringevuld op de kaart');
    failed += 1;
  } else {
    ok('Texel staat vooringevuld op de kaart');
  }
  var nLabels = await page.$$eval('#topo-drop-tray-inner .topo-label', function (els) { return els.length; });
  if (nLabels !== 7) {
    console.log('FAIL bak heeft ' + nLabels + ' labels, wil 7');
    failed += 1;
  } else {
    ok('bak toont 7 namen in de eerste ronde');
  }
  try {
    await assertGhostFollowsTouch('#topo-drop-tray-inner .topo-label', 'Friesland-label');
  } catch (err) {
    console.log('FAIL ' + err.message);
    failed += 1;
  }

  await browser.close();
  if (failed) {
    console.log('FAILED ' + failed);
    process.exit(1);
  }
  console.log('ALL FRIESLAND CHECKS OK');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
