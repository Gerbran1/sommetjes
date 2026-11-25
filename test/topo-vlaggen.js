/**
 * Flag data correctness for Vlaggen van Europa.
 * Serve the app at http://127.0.0.1:8765 then:
 *   NODE_PATH=/path/to/node_modules node test/topo-vlaggen.js
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
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle0', timeout: 20000 });
  const report = await page.evaluate(() => {
    var t = window.__topoTest;
    var out = [];
    function assert(cond, msg) {
      out.push((cond ? 'OK ' : 'FAIL ') + msg);
    }
    if (!t) {
      out.push('FAIL no __topoTest');
      return out;
    }
    var easyV = t.idsWhere('easyV');
    var hardV = t.idsWhere('hardV');
    assert(easyV.length >= 10 && easyV.length <= 12, 'makkelijk vlaggen heeft ' + easyV.length + ' (ongeveer 10)');
    assert(hardV.length >= 25, 'moeilijk vlaggen heeft ' + hardV.length + ' (>=25)');
    var need = ['nl', 'be', 'de', 'fr', 'es', 'it', 'gb', 'pl', 'pt', 'ie'];
    var i, id, land, svg, colors;
    for (i = 0; i < need.length; i++) {
      assert(easyV.indexOf(need[i]) !== -1, 'makkelijk vlag bevat ' + need[i]);
    }
    colors = {
      nl: ['#AE1C28', '#21468B'],
      be: ['#FAE042', '#ED2939'],
      de: ['#000', '#DD0000', '#FFCE00'],
      fr: ['#002395', '#ED2939'],
      es: ['#AA151B', '#F1BF00'],
      it: ['#009246', '#CE2B37'],
      gb: ['#012169', '#C8102E'],
      pl: ['#DC143C'],
      pt: ['#006600', '#FF0000'],
      ie: ['#169B62', '#FF883E'],
      se: ['#006AA7', '#FECC00'],
      ch: ['#FF0000'],
      ua: ['#005BBB', '#FFD500']
    };
    for (i = 0; i < hardV.length; i++) {
      id = hardV[i];
      land = t.landById(id);
      assert(!!land, 'land ' + id + ' bestaat');
      assert(!!land.name && land.name.length > 2, id + ' Nederlandse naam: ' + (land && land.name));
      assert(!!land.audio && land.audio.indexOf('land-') === 0, id + ' audio');
      svg = t.flagSvg(id, 60, 40);
      assert(svg && svg.indexOf('<svg') !== -1 && svg.indexOf('</svg>') !== -1, id + ' heeft inline SVG');
      assert(svg.indexOf('url(#') === -1, id + ' geen gradient/url(#) (iOS 9)');
      if (colors[id]) {
        (function (cid, expect) {
          var k;
          for (k = 0; k < expect.length; k++) {
            assert(svg.toUpperCase().indexOf(expect[k].toUpperCase()) !== -1, cid + ' bevat kleur ' + expect[k]);
          }
        })(id, colors[id]);
      }
    }
    assert(t.flagSvg('ch', 40, 40).indexOf('viewBox="0 0 40 40"') !== -1, 'Zwitserse vlag is vierkant');
    return out;
  });
  var failed = 0, i;
  for (i = 0; i < report.length; i++) {
    console.log(report[i]);
    if (report[i].indexOf('FAIL') === 0) failed += 1;
  }
  await browser.close();
  if (failed) {
    console.error('TEST FAILED (' + failed + ')');
    process.exit(1);
  }
  console.log('ALL TOPO VLAGGEN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
