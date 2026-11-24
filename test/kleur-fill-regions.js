'use strict';
/**
 * For every kleurplaat, flood-fill sample points on the live canvas and
 * assert that a fill stays under ~25% of the canvas, except the intended
 * background (the region that touches the canvas border / paper edge).
 *
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/kleur-fill-regions.js
 */
const puppeteer = require('puppeteer-core');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const MAX_INNER_PCT = 25;

const PAGES = [
  'monstertruck', 'dino', 'raket', 'draak', 'eenhoorn', 'brandweerauto',
  'piratenschip', 'boerderijdieren', 'kasteel', 'vliegtuig', 'prinses', 'onderwater'
];

/* Known spots that used to leak into the sky / half the page (PNG 1024x768). */
const LEAK_SAMPLES = {
  monstertruck: [{ x: 512, y: 620, name: 'heuvel' }, { x: 121, y: 87, name: 'ster' }, { x: 635, y: 308, name: 'portier' }],
  dino: [{ x: 191, y: 124, name: 'rook' }, { x: 500, y: 720, name: 'grond' }, { x: 910, y: 418, name: 'palmstam' }, { x: 600, y: 400, name: 'dino' }],
  draak: [{ x: 150, y: 300, name: 'berg-links' }, { x: 850, y: 300, name: 'berg-rechts' }, { x: 80, y: 600, name: 'voorgrond' }, { x: 500, y: 600, name: 'rots' }],
  piratenschip: [{ x: 500, y: 650, name: 'zee' }, { x: 400, y: 280, name: 'zeil' }],
  onderwater: [{ x: 500, y: 700, name: 'zand' }, { x: 449, y: 401, name: 'octopus' }],
  boerderijdieren: [{ x: 200, y: 700, name: 'grond' }, { x: 400, y: 500, name: 'varken' }],
  brandweerauto: [{ x: 512, y: 739, name: 'grond' }, { x: 400, y: 400, name: 'auto' }],
  prinses: [{ x: 200, y: 750, name: 'grond' }, { x: 400, y: 400, name: 'jurk' }],
  eenhoorn: [{ x: 500, y: 350, name: 'regenboog' }, { x: 400, y: 200, name: 'lijf' }],
  kasteel: [{ x: 512, y: 680, name: 'gracht' }, { x: 500, y: 400, name: 'muur' }],
  raket: [{ x: 512, y: 300, name: 'raket' }, { x: 200, y: 150, name: 'maan' }],
  vliegtuig: [{ x: 500, y: 350, name: 'toestel' }, { x: 200, y: 500, name: 'wolk' }]
};

async function waitOutline(page) {
  var deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    var ready = await page.evaluate(function () {
      var c = document.getElementById('teken-outline');
      if (!c) return false;
      var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      var i, n = 0;
      for (i = 3; i < d.length; i += 16) if (d[i] > 40) n++;
      return n > 200;
    });
    if (ready) return true;
    await wait(100);
  }
  return false;
}

async function openFromKies(page, id) {
  var onTeken = await page.evaluate(function () {
    var el = document.getElementById('screen-teken');
    return el && el.className.indexOf('is-hidden') === -1;
  });
  if (onTeken) {
    await page.click('#btn-teken-back');
    await wait(350);
  }
  var onKies = await page.evaluate(function () {
    var el = document.getElementById('screen-kleurkies');
    return el && el.className.indexOf('is-hidden') === -1;
  });
  if (!onKies) {
    throw new Error('niet op kleurkies voor ' + id);
  }
  await page.click('[data-page="' + id + '"]');
  await page.waitForSelector('#screen-teken:not(.is-hidden)');
  if (!(await waitOutline(page))) throw new Error('outline niet geladen: ' + id);
}

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.goto(APP, { waitUntil: 'networkidle0' });
  await page.evaluate(function () { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle0' });
  await wait(200);
  await page.click('#btn-goto-tekenen');
  await wait(250);
  await page.click('[data-act="teken-kleur"]');
  await wait(400);

  var failed = [];
  var i, id, report, j, rec;

  for (i = 0; i < PAGES.length; i++) {
    id = PAGES[i];
    await openFromKies(page, id);
    report = await page.evaluate(function (samples) {
      var paper = document.getElementById('teken-paper');
      var outline = document.getElementById('teken-outline');
      if (!paper || !outline) return { error: 'geen canvas' };
      var w = paper.width, h = paper.height, tot = w * h;
      var odata = outline.getContext('2d').getImageData(0, 0, w, h).data;

      function isWall(x, y) {
        if (x < 0 || y < 0 || x >= w || y >= h) return true;
        return odata[(y * w + x) * 4 + 3] > 40;
      }

      function floodArea(sx, sy) {
        if (isWall(sx, sy)) return { area: 0, pct: 0, wall: true, touchesBorder: false };
        var seen = new Uint8Array(tot);
        var stack = [sx, sy];
        var area = 0, touches = false, x, y, pos;
        seen[sy * w + sx] = 1;
        while (stack.length) {
          y = stack.pop();
          x = stack.pop();
          if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
          area++;
          if (x + 1 < w && !seen[y * w + x + 1] && !isWall(x + 1, y)) { seen[y * w + x + 1] = 1; stack.push(x + 1, y); }
          if (x - 1 >= 0 && !seen[y * w + x - 1] && !isWall(x - 1, y)) { seen[y * w + x - 1] = 1; stack.push(x - 1, y); }
          if (y + 1 < h && !seen[(y + 1) * w + x] && !isWall(x, y + 1)) { seen[(y + 1) * w + x] = 1; stack.push(x, y + 1); }
          if (y - 1 >= 0 && !seen[(y - 1) * w + x] && !isWall(x, y - 1)) { seen[(y - 1) * w + x] = 1; stack.push(x, y - 1); }
        }
        return { area: area, pct: area * 100 / tot, wall: false, touchesBorder: touches };
      }

      function pngToCanvas(px, py) {
        var pad = Math.round(Math.min(w, h) * 0.03);
        var iw = 1024, ih = 768;
        var s = Math.min((w - pad * 2) / iw, (h - pad * 2) / ih);
        var dw = iw * s, dh = ih * s;
        var dx = (w - dw) / 2, dy = (h - dh) / 2;
        return { x: Math.floor(dx + px * s), y: Math.floor(dy + py * s) };
      }

      /* Connected components of free pixels; take the largest inner seeds. */
      var labels = new Int32Array(tot);
      var comp = 0;
      var stats = [];
      var x, y, pos, k, qx, qy, q, area, touches, cx, cy, start;
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          pos = y * w + x;
          if (labels[pos] || odata[pos * 4 + 3] > 40) continue;
          comp++;
          q = [x, y];
          labels[pos] = comp;
          area = 0;
          touches = false;
          cx = 0;
          cy = 0;
          while (q.length) {
            qy = q.pop();
            qx = q.pop();
            area++;
            cx += qx;
            cy += qy;
            if (qx === 0 || qy === 0 || qx === w - 1 || qy === h - 1) touches = true;
            if (qx + 1 < w && !labels[qy * w + qx + 1] && odata[(qy * w + qx + 1) * 4 + 3] <= 40) {
              labels[qy * w + qx + 1] = comp; q.push(qx + 1, qy);
            }
            if (qx - 1 >= 0 && !labels[qy * w + qx - 1] && odata[(qy * w + qx - 1) * 4 + 3] <= 40) {
              labels[qy * w + qx - 1] = comp; q.push(qx - 1, qy);
            }
            if (qy + 1 < h && !labels[(qy + 1) * w + qx] && odata[((qy + 1) * w + qx) * 4 + 3] <= 40) {
              labels[(qy + 1) * w + qx] = comp; q.push(qx, qy + 1);
            }
            if (qy - 1 >= 0 && !labels[(qy - 1) * w + qx] && odata[((qy - 1) * w + qx) * 4 + 3] <= 40) {
              labels[(qy - 1) * w + qx] = comp; q.push(qx, qy - 1);
            }
          }
          stats.push({
            id: comp,
            area: area,
            pct: area * 100 / tot,
            touches: touches,
            cx: Math.floor(cx / area),
            cy: Math.floor(cy / area)
          });
        }
      }
      stats.sort(function (a, b) { return b.area - a.area; });

      var results = [];
      var inner = [];
      for (k = 0; k < stats.length; k++) {
        if (!stats[k].touches && stats[k].pct >= 0.2) inner.push(stats[k]);
      }
      /* A few of the largest inner regions. */
      for (k = 0; k < inner.length && k < 10; k++) {
        results.push({
          name: 'inner-' + k,
          x: inner[k].cx,
          y: inner[k].cy,
          fill: floodArea(inner[k].cx, inner[k].cy),
          kind: 'inner'
        });
      }
      /* Background corner should be allowed to be large. */
      start = floodArea(2, 2);
      results.push({ name: 'hoek-achtergrond', x: 2, y: 2, fill: start, kind: 'background' });

      for (k = 0; k < samples.length; k++) {
        var p = pngToCanvas(samples[k].x, samples[k].y);
        /* If we landed on ink, walk a few pixels for a free neighbour. */
        var sx = p.x, sy = p.y, found = !isWall(sx, sy), r, a, b;
        if (!found) {
          for (r = 1; r <= 12 && !found; r++) {
            for (a = -r; a <= r && !found; a++) {
              for (b = -r; b <= r && !found; b++) {
                if (!isWall(p.x + a, p.y + b)) { sx = p.x + a; sy = p.y + b; found = true; }
              }
            }
          }
        }
        results.push({
          name: samples[k].name,
          x: sx,
          y: sy,
          fill: found ? floodArea(sx, sy) : { area: 0, pct: 0, wall: true, touchesBorder: false },
          kind: 'sample'
        });
      }
      return { w: w, h: h, results: results, nInner: inner.length, nComp: stats.length };
    }, LEAK_SAMPLES[id] || []);

    if (report.error) {
      failed.push(id + ': ' + report.error);
      console.log('FAIL ' + id + ': ' + report.error);
      continue;
    }
    var okPage = true;
    var lines = [];
    for (j = 0; j < report.results.length; j++) {
      rec = report.results[j];
      var pct = rec.fill && rec.fill.pct ? rec.fill.pct : 0;
      var isBg = rec.kind === 'background' || (rec.fill && rec.fill.touchesBorder);
      var bad = !isBg && !rec.fill.wall && pct > MAX_INNER_PCT;
      if (bad) {
        okPage = false;
        failed.push(id + ' ' + rec.name + ' vult ' + pct.toFixed(2) + '% (max ' + MAX_INNER_PCT + '%)');
      }
      lines.push((bad ? 'FAIL ' : 'ok   ') + rec.name + ' ' + pct.toFixed(2) + '%' +
        (isBg ? ' [achtergrond]' : '') + (rec.fill.wall ? ' [lijn]' : ''));
    }
    console.log((okPage ? 'OK  ' : 'FAIL') + ' ' + id + ' canvas=' + report.w + 'x' + report.h +
      ' inner-regios>=0.2%=' + report.nInner);
    for (j = 0; j < lines.length; j++) console.log('     ' + lines[j]);
  }

  await browser.close();
  if (failed.length) {
    console.error('\nFAILED:\n' + failed.join('\n'));
    process.exit(1);
  }
  console.log('\nALL KLEUR FILL REGION CHECKS OK');
})().catch(function (e) {
  console.error(e && e.stack || e);
  process.exit(1);
});
