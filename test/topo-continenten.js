/**
 * Continenten puzzel: data, snap and pre-fill rules.
 *   NODE_PATH=... node test/topo-continenten.js
 */
const puppeteer = require('puppeteer-core');

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
    if (!t || !t.continenten) {
      out.push('FAIL no __topoTest.continenten');
      return out;
    }
    var i, c, hit, easy = [], hard = [], need, names;
    for (i = 0; i < t.continenten.length; i++) {
      c = t.continenten[i];
      if (c.easyP) easy.push(c.id);
      if (c.hardP) hard.push(c.id);
    }
    assert(t.continenten.length === 7, '7 werelddelen (kreeg ' + t.continenten.length + ')');
    assert(easy.length === 5, 'makkelijk heeft 5 losse delen (kreeg ' + easy.length + ')');
    assert(hard.length === 7, 'moeilijk heeft 7 losse delen (kreeg ' + hard.length + ')');
    need = ['eu', 'as', 'af', 'na', 'sa'];
    for (i = 0; i < need.length; i++) {
      assert(easy.indexOf(need[i]) !== -1, 'makkelijk bevat ' + need[i]);
    }
    assert(easy.indexOf('oc') === -1 && easy.indexOf('an') === -1, 'Oceanië en Antarctica zijn vooringevuld op makkelijk');
    assert(hard.indexOf('oc') !== -1 && hard.indexOf('an') !== -1, 'Oceanië en Antarctica zit in moeilijk');
    names = {};
    for (i = 0; i < t.continenten.length; i++) {
      c = t.continenten[i];
      names[c.id] = c.name;
      assert(!!c.path && c.path.charAt(0) === 'M', c.id + ' heeft pad');
      assert(c.w > 20 && c.h > 20, c.id + ' bbox ' + c.w + 'x' + c.h);
      assert(!!c.audio && c.audio.indexOf('land-') === 0, c.id + ' audio');
      assert(c.color && c.color.charAt(0) === '#', c.id + ' kleur');
      hit = t.pickSnap(c.cx, c.cy, [c.id]);
      assert(hit && hit.id === c.id, c.id + ' snap op eigen centroid');
      hit = t.pickSnap(c.cx + 3000, c.cy + 3000, [c.id]);
      assert(!hit, c.id + ' geen snap ver weg');
      if (t.pointInPath) {
        assert(t.pointInPath(c.cx, c.cy, c.path), c.id + ' centroid ligt in het pad');
      }
      var r = t.snapRadius(c);
      assert(r >= 28, c.id + ' snapstraal ' + r);
    }
    assert(names.eu === 'Europa' && names.as === 'Azië' && names.af === 'Afrika', 'Europese namen Europa/Azië/Afrika');
    assert(names.na === 'Noord-Amerika' && names.sa === 'Zuid-Amerika', 'Noord- en Zuid-Amerika');
    assert(names.oc === 'Oceanië' && names.an === 'Antarctica', 'Oceanië en Antarctica');
    // Europe vs Africa centroids should not steal each other
    var eu, af;
    for (i = 0; i < t.continenten.length; i++) {
      if (t.continenten[i].id === 'eu') eu = t.continenten[i];
      if (t.continenten[i].id === 'af') af = t.continenten[i];
    }
    hit = t.pickSnap(eu.cx, eu.cy, ['eu', 'af', 'as']);
    assert(hit && hit.id === 'eu', 'Europa-centroid kiest Europa, niet ' + (hit && hit.id));
    hit = t.pickSnap(af.cx, af.cy, ['eu', 'af', 'as']);
    assert(hit && hit.id === 'af', 'Afrika-centroid kiest Afrika, niet ' + (hit && hit.id));
    assert(t.worldVbW > 800 && t.worldVbH > 400, 'wereld-viewBox ' + t.worldVbW + 'x' + t.worldVbH);
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
  console.log('ALL TOPO CONTINENTEN CHECKS OK');
  process.exit(0);
})().catch(function (e) {
  console.error('TEST FAILED');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
