/**
 * Nederland provincies: puzzel, Waar ligt, en Hoofdsteden.
 *   NODE_PATH=... node test/topo-provincies.js
 */
const puppeteer = require('puppeteer-core');

const APP = 'http://127.0.0.1:8765/index.html';

function ok(msg) { console.log('OK  ' + msg); }

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768, isMobile: true, hasTouch: true, isLandscape: true });
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });

  const report = await page.evaluate(() => {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t || !t.provincies) {
      out.push('FAIL no __topoTest.provincies');
      return out;
    }
    var i, p, hit, byId, names, need, caps, capByProv, ids, unique, qid, q, other, texts, foundName, svg, nText, nPath, utrecht, flevoland, gelderland, pt, near, far;

    assert(t.provincies.length === 12, '12 provincies (kreeg ' + t.provincies.length + ')');
    assert(t.provVbW === 720 && t.provVbH === 857, 'NL-viewBox ' + t.provVbW + 'x' + t.provVbH);

    need = ['groningen','friesland','drenthe','overijssel','flevoland','gelderland',
            'utrecht','noordholland','zuidholland','zeeland','noordbrabant','limburg'];
    names = {
      groningen: 'Groningen', friesland: 'Friesland', drenthe: 'Drenthe',
      overijssel: 'Overijssel', flevoland: 'Flevoland', gelderland: 'Gelderland',
      utrecht: 'Utrecht', noordholland: 'Noord-Holland', zuidholland: 'Zuid-Holland',
      zeeland: 'Zeeland', noordbrabant: 'Noord-Brabant', limburg: 'Limburg'
    };
    caps = {
      friesland: 'Leeuwarden', groningen: 'Groningen', drenthe: 'Assen',
      overijssel: 'Zwolle', flevoland: 'Lelystad', gelderland: 'Arnhem',
      utrecht: 'Utrecht', noordholland: 'Haarlem', zuidholland: 'Den Haag',
      zeeland: 'Middelburg', noordbrabant: "'s-Hertogenbosch", limburg: 'Maastricht'
    };
    byId = {};
    for (i = 0; i < t.provincies.length; i++) {
      p = t.provincies[i];
      byId[p.id] = p;
      assert(need.indexOf(p.id) !== -1, p.id + ' is een Nederlandse provincie');
      assert(p.name === names[p.id], p.id + ' heet ' + p.name);
      assert(!!p.path && p.path.charAt(0) === 'M', p.id + ' heeft pad');
      assert(p.w > 40 && p.h > 40, p.id + ' bbox ' + p.w + 'x' + p.h);
      assert(p.audio === 'provincie-' + p.id, p.id + ' audio ' + p.audio);
      assert(p.color && p.color.charAt(0) === '#', p.id + ' kleur');
      assert(p.easyP === 1 && p.hardP === 1, p.id + ' staat in de hele set');
      assert(p.capName === caps[p.id], p.id + ' hoofdstad ' + p.capName);
      assert(!!p.capAudio && p.capAudio.indexOf('stad-') === 0, p.id + ' cap audio');
      if (t.pointInPath) {
        assert(t.pointInPath(p.cx, p.cy, p.path), p.id + ' centroid ligt in het pad');
        assert(t.pointInPath(p.capX, p.capY, p.path), p.capName + ' ligt in ' + p.name);
      }
    }
    for (i = 0; i < need.length; i++) {
      assert(!!byId[need[i]], 'set bevat ' + need[i]);
    }

    // IJsselmeer / Markermeer zijn water, Flevoland is een polder
    assert(!!t.provWater && t.provWater.charAt(0) === 'M', 'IJsselmeer-pad is aanwezig');
    flevoland = null;
    for (i = 0; i < t.provincies.length; i++) {
      if (t.provincies[i].id === 'flevoland') flevoland = t.provincies[i];
    }
    assert(!!flevoland, 'Flevoland bestaat');
    var wx, wy, step;
    wx = wy = null;
    for (step = 8; step <= 140; step += 2) {
      pt = { x: flevoland.capX - step, y: flevoland.capY };
      if (!t.pointInPath(pt.x, pt.y, flevoland.path)) {
        wx = pt.x; wy = pt.y;
        break;
      }
    }
    assert(wx != null, 'er is water ten westen van Lelystad');
    assert(t.pointInPath(wx, wy, t.provWater), 'Markermeer/IJsselmeer ten westen van Lelystad is water');
    assert(!t.pointInPath(wx, wy, flevoland.path), 'Flevoland is uit het meer geknipt');
    var nh, fr;
    for (i = 0; i < t.provincies.length; i++) {
      if (t.provincies[i].id === 'noordholland') nh = t.provincies[i];
      if (t.provincies[i].id === 'friesland') fr = t.provincies[i];
    }
    assert(!t.pointInPath(wx, wy, nh.path) && !t.pointInPath(wx, wy, fr.path), 'het meer hoort ook niet bij Noord-Holland of Friesland');
    assert(t.pointInPath(flevoland.capX, flevoland.capY, flevoland.path), 'Lelystad blijft in Flevoland');

    // Sleeppuzzel: 12 stukken, snap op eigen centroid
    t.getState().game = 'provpuzzel';
    if (t.startPuzzel) t.startPuzzel('hard', true);
    assert(t.getState().game === 'provpuzzel', 'puzzel-game blijft provpuzzel');
    assert(t.getState().total === 12 && t.getState().remain && t.getState().remain.length === 12, 'puzzel heeft 12 stukken');
    var pieces = document.querySelectorAll('#topo-tray-inner .topo-piece');
    assert(pieces.length === 12, 'bak heeft 12 puzzelstukken (kreeg ' + pieces.length + ')');
    var named = 0;
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].textContent && pieces[i].textContent.replace(/\s/g, '').length) named += 1;
    }
    assert(named === 12, 'elk puzzelstuk toont een naam');
    var puzPrompt = document.getElementById('topo-puzzel-prompt');
    assert(puzPrompt && puzPrompt.textContent.indexOf('Provincies') !== -1, 'puzzel-prompt: ' + (puzPrompt && puzPrompt.textContent));
    for (i = 0; i < t.provincies.length; i++) {
      p = t.provincies[i];
      hit = t.pickSnap(p.cx, p.cy, [p.id]);
      assert(hit && hit.id === p.id, p.id + ' snap op eigen centroid');
      hit = t.pickSnap(p.cx + 3000, p.cy + 3000, [p.id]);
      assert(!hit, p.id + ' geen snap ver weg');
    }
    hit = t.pickSnap(byId.utrecht.cx, byId.utrecht.cy, ['utrecht', 'gelderland', 'noordholland']);
    assert(hit && hit.id === 'utrecht', 'Utrecht-centroid kiest Utrecht, niet ' + (hit && hit.id));

    // Waar ligt provincies: alle 12, labels, Oeps/hint na 2 fouten
    t.startWaar('hard', true, 'provwaar');
    assert(t.getState().game === 'provwaar', 'waar-game is provwaar');
    svg = document.getElementById('topo-waar-svg');
    assert(!!svg, 'provinciekaart is getekend');
    nPath = svg ? svg.querySelectorAll('path[data-topo-id]').length : 0;
    assert(nPath === 12, '12 tikkbare provincies (kreeg ' + nPath + ')');
    t.getState().used = [];
    t.getState().found = {};
    t.startWaar('hard', true, 'provwaar');
    ids = [t.getState().q.id];
    for (i = 0; i < 11; i++) {
      t.startWaar('hard', false, 'provwaar');
      ids.push(t.getState().q.id);
    }
    unique = {};
    for (i = 0; i < ids.length; i++) unique[ids[i]] = 1;
    assert(ids.length === 12 && Object.keys(unique).length === 12, 'alle 12 provincies komen in de ronde voor');

    t.startWaar('hard', true, 'provwaar');
    qid = t.getState().q.id;
    q = byId[qid];
    other = byId[qid === 'utrecht' ? 'limburg' : 'utrecht'];
    assert(t.waarPrompt(q).indexOf('Waar ligt ' + q.name) === 0, 'prompt ' + t.waarPrompt(q));
    assert(t.waarAudio(q) === 'waar-ligt-provincie-' + q.id, 'audio ' + t.waarAudio(q));
    hit = t.waarHit(q.cx, q.cy, 'hard');
    assert(hit && hit.id === q.id, 'tik in ' + q.id + ' kiest ' + (hit && hit.id));
    t.waarTap(other);
    assert(t.getState().misses === 1 && !t.getState().hintId, 'na 1 fout: Oeps, nog geen hint');
    t.waarTap(other);
    assert(t.getState().misses === 2 && t.getState().hintId === qid, 'na 2 fouten knippert het goede antwoord');
    t.waarTap(q);
    assert(t.getState().found && t.getState().found[qid], 'goed tik markeert ' + qid);
    texts = document.querySelectorAll('#topo-waar-svg text');
    foundName = false;
    for (i = 0; i < texts.length; i++) {
      if (texts[i].textContent === q.name) foundName = true;
    }
    assert(foundName, 'naam blijft op de kaart staan (' + q.name + ')');

    // Hoofdsteden: drop anywhere in the province, forgiving pad, no province names
    t.startDrop('hoofdstad', true);
    assert(t.getState().game === 'hoofdstad', 'drop-game is hoofdstad');
    assert(t.getState().total === 12 && t.getState().remain.length === 12, '12 hoofdsteden in de bak');
    var labels = document.querySelectorAll('#topo-drop-tray-inner .topo-label');
    assert(labels.length === 12, 'bak toont 12 hoofdsteden (kreeg ' + labels.length + ')');
    var dropPrompt = document.getElementById('topo-drop-prompt');
    assert(dropPrompt && String(dropPrompt.textContent).trim() === 'Hoofdsteden', 'drop-prompt: ' + (dropPrompt && dropPrompt.textContent));
    svg = document.getElementById('topo-drop-svg');
    assert(!!svg, 'hoofdstedenkaart is getekend');
    nText = 0;
    if (svg) {
      texts = svg.querySelectorAll('text');
      nText = texts.length;
      for (i = 0; i < texts.length; i++) {
        assert(need.indexOf(texts[i].textContent.toLowerCase().replace(/-/g, '')) === -1, 'geen provincienaam op de kaart: ' + texts[i].textContent);
        for (var ni = 0; ni < need.length; ni++) {
          if (texts[i].textContent === names[need[ni]]) {
            assert(false, 'provincienaam zichtbaar: ' + texts[i].textContent);
          }
        }
      }
    }
    assert(nText === 0, 'verse ronde toont geen namen op de kaart (kreeg ' + nText + ')');

    utrecht = byId.utrecht;
    flevoland = byId.flevoland;
    gelderland = byId.gelderland;
    hit = t.dropHit(utrecht.capX, utrecht.capY);
    assert(hit && hit.id === utrecht.capId, 'drop op Utrecht-stad kiest ' + (hit && hit.name));
    hit = t.dropHit(utrecht.cx, utrecht.cy);
    assert(hit && hit.id === utrecht.capId, 'drop ergens in Utrecht (centroid) telt, niet precies op de stad');
    hit = t.dropHit(gelderland.cx, gelderland.cy);
    assert(hit && hit.id === gelderland.capId, 'drop in Gelderland kiest Arnhem, niet ' + (hit && hit && hit.name));
    // far miss
    hit = t.dropHit(-200, -200);
    assert(!hit, 'drop ver buiten Nederland mist');
    // forgiving: a point just outside Flevoland into the IJsselmeer (west of Lelystad)
    near = null;
    for (i = 8; i <= 40; i += 2) {
      pt = { x: flevoland.capX - i, y: flevoland.capY };
      if (!t.pointInPath(pt.x, pt.y, flevoland.path) && !t.pointInPath(pt.x, pt.y, byId.noordholland.path)) {
        near = pt;
        break;
      }
    }
    if (near) {
      hit = t.dropHit(near.x, near.y);
      assert(hit && hit.id === flevoland.capId, 'vergevende zone naast Flevoland kiest Lelystad (kreeg ' + (hit && hit.name) + ')');
    } else {
      out.push('OK  (geen waterpunt naast Flevoland gevonden, pad-test is genoeg)');
    }
    // neighbour must not be stolen
    hit = t.dropHit(gelderland.capX, gelderland.capY);
    assert(hit && hit.id === gelderland.capId, 'Arnhem blijft Gelderland');

    return out;
  });

  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }

  async function openTopo() {
    await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
    await page.click('#btn-goto-topo');
    await page.waitForSelector('#topo-grid [data-game="provpuzzel"]', { timeout: 8000 });
  }

  await openTopo();
  var nBtn = await page.$$eval('#topo-grid [data-act="topo-game"]', function (els) { return els.length; });
  if (nBtn !== 10) {
    console.log('FAIL topo-menu heeft ' + nBtn + ' knoppen, verwacht 10');
    failed += 1;
  } else {
    ok('topo-menu heeft 10 kaarten');
  }

  await page.click('#topo-grid [data-game="provpuzzel"]');
  try {
    await page.waitForSelector('#screen-topopuzzel:not(.is-hidden)', { timeout: 8000 });
    ok('Provincies puzzel start direct, zonder Makkelijk/Moeilijk');
  } catch (err) {
    console.log('FAIL Provincies puzzel start niet op het puzzel-scherm');
    failed += 1;
  }

  await openTopo();
  await page.click('#topo-grid [data-game="provwaar"]');
  try {
    await page.waitForSelector('#screen-topowaar:not(.is-hidden)', { timeout: 8000 });
    ok('Waar ligt de provincie? start direct als tikspel');
  } catch (err) {
    console.log('FAIL Waar ligt de provincie start niet op het Waar-ligt-scherm');
    failed += 1;
  }
  var waarPrompt = await page.$eval('#topo-waar-prompt', function (el) { return el.textContent; });
  if (waarPrompt.indexOf('Waar ligt') !== 0) {
    console.log('FAIL waar-prompt was ' + waarPrompt);
    failed += 1;
  } else {
    ok('waar-prompt: ' + waarPrompt);
  }

  await openTopo();
  await page.click('#topo-grid [data-game="hoofdstad"]');
  try {
    await page.waitForSelector('#screen-topodrop:not(.is-hidden)', { timeout: 8000 });
    ok('Hoofdsteden start direct als sleepspel');
  } catch (err) {
    console.log('FAIL Hoofdsteden start niet op het drop-scherm');
    failed += 1;
  }

  async function fitViewport(w, h, label) {
    await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true });
    var games = [
      { game: 'provpuzzel', screen: 'topopuzzel', sel: '#screen-topopuzzel:not(.is-hidden)', tray: '#topo-tray', chips: '#topo-tray-inner .topo-piece', wrap: '#topo-map-wrap' },
      { game: 'provwaar', screen: 'topowaar', sel: '#screen-topowaar:not(.is-hidden)', tray: null, chips: null, wrap: '#topo-waar-map-wrap' },
      { game: 'hoofdstad', screen: 'topodrop', sel: '#screen-topodrop:not(.is-hidden)', tray: '#topo-drop-tray', chips: '#topo-drop-tray-inner .topo-label', wrap: '#topo-drop-map-wrap' }
    ];
    var g, i, lines;
    for (i = 0; i < games.length; i++) {
      g = games[i];
      await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
      await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, isLandscape: true });
      await page.click('#btn-goto-topo');
      await page.waitForSelector('#topo-grid [data-game="' + g.game + '"]', { timeout: 8000 });
      await page.click('#topo-grid [data-game="' + g.game + '"]');
      await page.waitForSelector(g.sel, { timeout: 8000 });
      await new Promise(function (r) { setTimeout(r, 200); });
      lines = await page.evaluate(function (g, w, h, label) {
        var t = window.__topoTest;
        var out = [];
        function assert(cond, msg) {
          out.push((cond ? 'OK ' : 'FAIL ') + label + ' ' + g.game + ': ' + msg);
        }
        var wrap = document.querySelector(g.wrap);
        var wr, meet, p, i, minx, miny, maxx, maxy, pts, pt, cx, cy, tray, chips, r, vh, vw, margin;
        vw = window.innerWidth;
        vh = window.innerHeight;
        assert(!!wrap, 'kaart-wrap bestaat');
        if (!wrap || !t) return out;
        wr = wrap.getBoundingClientRect();
        margin = 4;
        assert(wr.top >= -1 && wr.left >= -1, 'kaart-wrap begint in beeld (' + Math.round(wr.left) + ',' + Math.round(wr.top) + ')');
        assert(wr.bottom <= vh + 1 && wr.right <= vw + 1, 'kaart-wrap blijft in beeld (bottom ' + Math.round(wr.bottom) + '/' + vh + ', right ' + Math.round(wr.right) + '/' + vw + ')');
        meet = t.meetFromRect(wr, t.provVbW, t.provVbH);
        minx = 1e9; miny = 1e9; maxx = 0; maxy = 0;
        for (i = 0; i < t.provincies.length; i++) {
          p = t.provincies[i];
          minx = Math.min(minx, p.x);
          miny = Math.min(miny, p.y);
          maxx = Math.max(maxx, p.x + p.w);
          maxy = Math.max(maxy, p.y + p.h);
        }
        pts = [
          ['Wadden/noord', minx + (maxx - minx) / 2, miny + 2],
          ['Zeeland-west', minx + 2, maxy - (maxy - miny) * 0.25],
          ['Limburg-zuid', maxx - (maxx - minx) * 0.35, maxy - 2],
          ['Groningen-noordoost', maxx - 2, miny + (maxy - miny) * 0.15]
        ];
        for (i = 0; i < pts.length; i++) {
          cx = meet.left + pts[i][1] * meet.scale;
          cy = meet.top + pts[i][2] * meet.scale;
          assert(cx >= wr.left + margin && cx <= wr.right - margin && cy >= wr.top + margin && cy <= wr.bottom - margin,
            pts[i][0] + ' valt in de kaart met marge (' + Math.round(cx) + ',' + Math.round(cy) + ' wrap ' + Math.round(wr.left) + '-' + Math.round(wr.right) + ',' + Math.round(wr.top) + '-' + Math.round(wr.bottom) + ')');
          assert(cx >= margin && cx <= vw - margin && cy >= margin && cy <= vh - margin,
            pts[i][0] + ' blijft in het scherm');
        }
        if (g.tray) {
          tray = document.querySelector(g.tray);
          assert(!!tray, 'bak bestaat');
          if (tray) {
            r = tray.getBoundingClientRect();
            assert(r.top >= -1 && r.bottom <= vh + 1 && r.left >= -1 && r.right <= vw + 1,
              'bak blijft in beeld (bottom ' + Math.round(r.bottom) + '/' + vh + ')');
            assert(tray.scrollHeight <= tray.clientHeight + 2,
              'bak scrollt niet (scroll ' + tray.scrollHeight + ' / client ' + tray.clientHeight + ')');
            chips = tray.querySelectorAll(g.chips.split(' ').pop().indexOf('.') === 0 ? g.chips : g.chips);
            chips = document.querySelectorAll(g.chips);
            if (g.game === 'hoofdstad' || g.game === 'provpuzzel') {
              assert(chips.length === 12, '12 fiches/stukken zichtbaar (kreeg ' + chips.length + ')');
            }
            for (i = 0; i < chips.length; i++) {
              if (chips[i].offsetParent === null) continue;
              pt = chips[i].getBoundingClientRect();
              assert(pt.top >= r.top - 1 && pt.bottom <= r.bottom + 1 && pt.left >= r.left - 1 && pt.right <= r.right + 1,
                'fiche ' + (chips[i].textContent || '').replace(/\s+/g, ' ').trim() + ' valt in de bak (bottom ' + Math.round(pt.bottom) + '/' + Math.round(r.bottom) + ')');
              assert(pt.bottom <= vh + 1 && pt.right <= vw + 1,
                'fiche blijft in het scherm');
            }
          }
        }
        assert(document.documentElement.scrollHeight <= vh + 2 && document.documentElement.scrollWidth <= vw + 2,
          'pagina scrollt niet (doc ' + document.documentElement.scrollWidth + 'x' + document.documentElement.scrollHeight + ' / ' + vw + 'x' + vh + ')');
        return out;
      }, g, w, h, label);
      var j;
      for (j = 0; j < lines.length; j++) {
        console.log(lines[j]);
        if (lines[j].indexOf('FAIL') === 0) failed += 1;
      }
    }
  }

  await fitViewport(1024, 748, 'iPad 1024x748');
  await fitViewport(667, 375, 'telefoon 667x375');

  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL PROVINCIES CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
