/**
 * Start screen layout at iPad 2 portrait and landscape.
 *   NODE_PATH=... node test/start-layout.js
 */
'use strict';
const puppeteer = require('puppeteer-core');
const wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

const APP = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SHOT = process.env.SHOT_DIR || '/workspace/rekenapp/screenshots';

function ok(msg) { console.log('OK  ' + msg); }

async function check(page, width, height, shotName) {
  await page.setViewport({ width: width, height: height });
  await page.goto(APP, { waitUntil: 'networkidle0', timeout: 20000 });
  await wait(200);
  const info = await page.evaluate(function (vw, vh) {
    var tiles = document.querySelectorAll('#choice-grid .choice-btn');
    var players = document.querySelectorAll('#player-grid .player-btn');
    var i, r, lab, issues = [], items = [], rows = {};
    function box(el, kind) {
      var b = el.getBoundingClientRect();
      var labelEl = el.querySelector('.choice-label') || el;
      var label = (labelEl.textContent || '').replace(/\s+/g, ' ').trim();
      var clipped = false;
      if (labelEl.scrollWidth > labelEl.clientWidth + 1) clipped = true;
      if (b.left < -0.5) issues.push(kind + ' ' + label + ' clipped left ' + Math.round(b.left));
      if (b.right > vw + 0.5) issues.push(kind + ' ' + label + ' clipped right ' + Math.round(b.right) + '>' + vw);
      if (b.top < -0.5) issues.push(kind + ' ' + label + ' clipped top ' + Math.round(b.top));
      if (b.bottom > vh + 0.5) issues.push(kind + ' ' + label + ' clipped bottom ' + Math.round(b.bottom) + '>' + vh);
      if (b.width < 40 || b.height < 40) issues.push(kind + ' ' + label + ' too small ' + Math.round(b.width) + 'x' + Math.round(b.height));
      if (clipped) issues.push(kind + ' ' + label + ' text overflow scroll=' + labelEl.scrollWidth + ' client=' + labelEl.clientWidth);
      return {
        label: label,
        left: Math.round(b.left), right: Math.round(b.right),
        top: Math.round(b.top), bottom: Math.round(b.bottom),
        w: Math.round(b.width), h: Math.round(b.height)
      };
    }
    for (i = 0; i < tiles.length; i++) items.push(box(tiles[i], 'tile'));
    for (i = 0; i < players.length; i++) items.push(box(players[i], 'player'));
    var labels = [];
    for (i = 0; i < tiles.length; i++) {
      labels.push(items[i].label);
      rows[items[i].top] = (rows[items[i].top] || 0) + 1;
    }
    return {
      nTiles: tiles.length,
      nPlayers: players.length,
      labels: labels,
      issues: issues,
      tiles: items.slice(0, tiles.length),
      players: items.slice(tiles.length),
      rowSizes: rows
    };
  }, width, height);

  if (info.nTiles !== 9) throw new Error(shotName + ' expected 9 tiles, got ' + info.nTiles);
  if (info.nPlayers !== 3) throw new Error(shotName + ' expected 3 player buttons, got ' + info.nPlayers);
  if (info.labels.indexOf('Logica') === -1) throw new Error(shotName + ' Logica label missing: ' + info.labels.join(','));
  if (info.labels.indexOf('Topografie') === -1) throw new Error(shotName + ' Topografie label missing: ' + info.labels.join(','));
  if (info.labels.indexOf('Programmeren') !== -1) throw new Error(shotName + ' still says Programmeren');
  if (info.issues.length) {
    console.error('FAIL ' + shotName, info.issues, JSON.stringify({ tiles: info.tiles, players: info.players }));
    await page.screenshot({ path: SHOT + '/' + shotName });
    throw new Error(shotName + ' layout: ' + info.issues.join('; '));
  }
  await page.screenshot({ path: SHOT + '/' + shotName });
  ok(shotName + '  tiles=[' + info.labels.join(', ') + ']  players ok, all inside ' + width + 'x' + height);
  return info;
}

(async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1024,768']
  });
  const page = await browser.newPage();
  try {
    await check(page, 768, 1024, '54-start-portrait.png');
    await check(page, 1024, 768, '54-start-landscape.png');
    console.log('ALL START LAYOUT CHECKS OK');
    await browser.close();
    process.exit(0);
  } catch (e) {
    console.error('TEST FAILED');
    console.error(e && e.stack ? e.stack : e);
    try { await page.screenshot({ path: SHOT + '/54-start-fail.png' }); } catch (e2) {}
    await browser.close();
    process.exit(1);
  }
})();
