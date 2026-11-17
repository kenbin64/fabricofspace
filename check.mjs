// Opens the page in a real browser and checks it against facts it was not given: the dates of the seasons, perihelion, speeds and years.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';
// Chrome: set CHROME_PATH, or the usual install place on Windows, Mac or Linux is used.
const CHROME = process.env.CHROME_PATH || ({ win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe', darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }[process.platform] || '/usr/bin/google-chrome');
const here = import.meta.dirname, out = process.argv[2];
let passed = 0, failed = 0;
const check = (name, ok, info = '') => { if (ok) passed++; else failed++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name} ${info}`); };
const temp = path.join(here, '.check-copy.html');
fs.writeFileSync(temp, '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + fs.readFileSync(path.join(here, 'fabric-of-space.html'), 'utf8') + '</body></html>');
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
const errors = []; p.on('pageerror', (e) => errors.push(e.message)); p.on('requestfailed', (r) => errors.push('failed ' + r.url()));
await p.goto(pathToFileURL(temp).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
await p.waitForFunction(() => window.fabric, { timeout: 30000 }).catch((e) => { console.log('page failed to start:', errors.join(' | ')); throw e; });
await p.evaluate(() => { window.fabric.state.playing = false; });

// The seasons were not entered as dates. They must come out of the orbit and the held axis. Year 2000: Mar 20, Jun 21, Sep 22, Dec 21.
const dates = await p.evaluate(() => {
  const F = window.fabric, day0 = Date.UTC(2000, 0, 1, 12), on = (d) => new Date(day0 + d * 864e5).toISOString().slice(0, 10);
  let peak = 0, low = 0, spring = 0, autumn = 0, maxL = -99, minL = 99, closest = 9, peri = 0;
  for (let d = 0; d < 366; d += 0.05) { const s = F.seasonAt(d), n = F.seasonAt(d + 0.05); if (s.lat > maxL) { maxL = s.lat; peak = d; } if (s.lat < minL) { minL = s.lat; low = d; } if (s.lat < 0 && n.lat >= 0) spring = d; if (s.lat > 0 && n.lat <= 0) autumn = d; if (s.r < closest) { closest = s.r; peri = d; } }
  return { peak: on(peak), low: on(low), spring: on(spring), autumn: on(autumn), peri: on(peri), maxL, minL, closest };
});
console.log('  model dates', JSON.stringify(dates));
const within = (a, want, days) => Math.abs((new Date(a) - new Date(want)) / 864e5) <= days;
check('March equinox within 2 days of Mar 20', within(dates.spring, '2000-03-20', 2), dates.spring);
check('June solstice within 2 days of Jun 21', within(dates.peak, '2000-06-21', 2), dates.peak);
check('September equinox within 2 days of Sep 22', within(dates.autumn, '2000-09-22', 2), dates.autumn);
check('December solstice within 2 days of Dec 21', within(dates.low, '2000-12-21', 2), dates.low);
check('closest to the Sun in early January', within(dates.peri, '2000-01-03', 3), dates.peri);
check('Sun overhead reaches the tropics', Math.abs(dates.maxL - 23.44) < 0.01 && Math.abs(dates.minL + 23.44) < 0.01);

// Speeds and years, against standard figures.
const sp = await p.evaluate(() => Object.fromEntries(window.fabric.BODIES.map((q) => { const v = []; for (let d = 0; d < q.year * 365.25; d += q.year * 2) v.push(window.fabric.orbitAt(q, d).speed); return [q.name, [Math.min(...v), Math.max(...v)]]; })));
console.log('  speeds km/s', Object.entries(sp).map(([n, v]) => `${n} ${v[0].toFixed(1)}-${v[1].toFixed(1)}`).join(', '));
check('Mercury runs 38.9 to 59.0 km/s', Math.abs(sp.Mercury[0] - 38.86) < 0.1 && Math.abs(sp.Mercury[1] - 58.98) < 0.1);
check('Earth runs 29.3 to 30.3 km/s', Math.abs(sp.Earth[0] - 29.29) < 0.05 && Math.abs(sp.Earth[1] - 30.29) < 0.05);
check('Neptune runs about 5.4 km/s', Math.abs(sp.Neptune[0] - 5.43) < 0.1 && Math.abs(sp.Neptune[1] - 5.48) < 0.1);
const kepler = await p.evaluate(() => window.fabric.BODIES.map((q) => [q.name, q.a ** 1.5 / q.year]));
check('every year matches distance to the 1.5 power, within 0.2%', kepler.every((k) => Math.abs(k[1] - 1) < 0.002), kepler.map((k) => k[1].toFixed(4)).join(' '));
const speedVsPeriod = await p.evaluate(() => { const q = window.fabric.BODIES[2]; const d = q.year * 365.25; const a = window.fabric.orbitAt(q, 0), c = window.fabric.orbitAt(q, d); return Math.hypot(a.x - c.x, a.y - c.y); });
check('after one of its years, a planet is back within its slow drift', speedVsPeriod < 1e-3, speedVsPeriod.toExponential(1));
const circle = await p.evaluate(() => { const q = window.fabric.BODIES[6], a = window.fabric.orbitAt(q, 0), c = window.fabric.orbitAt(q, 365.25); return Math.acos((a.x * c.x + a.y * c.y) / (a.r * c.r)) * 180 / Math.PI; });
check('Uranus moves only about 4 degrees in an Earth year', circle > 3.5 && circle < 5, circle.toFixed(2));
const merc = await p.evaluate(() => 1 / window.fabric.BODIES[0].year);
check('Mercury goes around about 4.15 times in an Earth year', Math.abs(merc - 4.152) < 0.01, merc.toFixed(3));

// ACCURACY. NASA JPL Horizons, downloaded separately, heliocentric positions for each planet, 2000 to 2050 every ten years.
// Marks set before the comparison was run: every planet within 0.25 degrees in direction and 0.5% in distance, at every date.
const JPL = {}; for (const [id, name] of [[199, 'Mercury'], [299, 'Venus'], [399, 'Earth'], [499, 'Mars'], [599, 'Jupiter'], [699, 'Saturn'], [799, 'Uranus'], [899, 'Neptune']]) { const t = JSON.parse(fs.readFileSync(path.join(here, 'jpl', id + '.json'))).result, body = t.slice(t.indexOf('$$SOE') + 5, t.indexOf('$$EOE')).trim(); JPL[name] = body.split(/\r?\n/).map((l) => { const c = l.split(','); return { jd: Number(c[0]), x: Number(c[2]), y: Number(c[3]), z: Number(c[4]) }; }); }
const misses = await p.evaluate((J) => { const F = window.fabric, out = {}; for (const q of F.BODIES) { let ang = 0, rad = 0, n = 0; for (const e of J[q.name]) { const o = F.orbitAt(q, e.jd - 2451545), dot = o.x * e.x + o.y * e.y + o.z * e.z, rj = Math.hypot(e.x, e.y, e.z), rm = Math.hypot(o.x, o.y, o.z); ang = Math.max(ang, Math.acos(Math.min(1, dot / (rj * rm))) * 180 / Math.PI); rad = Math.max(rad, Math.abs(rm / rj - 1) * 100); n++; } out[q.name] = { ang, rad, n }; } return out; }, JPL);
for (const [name, m] of Object.entries(misses)) console.log(`  JPL ${name.padEnd(8)} worst direction miss ${m.ang.toFixed(3)} deg, worst distance miss ${m.rad.toFixed(3)}%, over ${m.n} dates`);
check('every planet matches JPL within 0.25 degrees and 0.5%', Object.values(misses).every((m) => m.ang < 0.25 && m.rad < 0.5));
const tilts = await p.evaluate(() => window.fabric.BODIES.map((q) => [q.name, window.fabric.orbitToGalaxy(q)]));
console.log('  orbit against galactic plane:', tilts.map(([n, t]) => `${n} ${t.toFixed(1)}`).join(', '));
check("Earth's orbit against the galactic plane is 60.2", Math.abs(tilts[2][1] - 60.19) < 0.05, tilts[2][1].toFixed(2));
check('each real orbit lies within 8 degrees of Earth', tilts.every(([, t]) => Math.abs(t - 60.19) < 8));
check('planets really leave the plane', await p.evaluate(() => { const F = window.fabric, m = F.BODIES[0]; let hi = 0; for (let d = 0; d < 88; d++) hi = Math.max(hi, Math.abs(F.orbitAt(m, d).z)); return hi > 0.04; }));

// The field, against hand figures. Sun alone at 1 AU: 1.32712e11 / 149597870.7 = 887.1 km2/s2.
const f = await p.evaluate(() => { const F = window.fabric, sunOnly = F.field(1, 0, 0) - F.field(1, 0, 0, 'Sun'), o = F.orbitAt(F.BODIES[2], 0), others = F.field(o.x, o.y, 0, 'Earth') - 1.32712e11 / (o.r * 149597870.7); return { sunOnly, share: others / (1.32712e11 / (o.r * 149597870.7)) * 100, r1: F.roundness(1, 0), r10: F.roundness(10, 0), r30: F.roundness(30, 0), r1b: F.roundness(1, 2000), r30b: F.roundness(30, 2000) }; });
check('the Sun alone gives 887.1 at 1 AU, by hand', Math.abs(f.sunOnly - 887.1) < 0.1, f.sunOnly.toFixed(2));
check('other bodies add little at Earth', f.share > 0 && f.share < 0.1, `${f.share.toFixed(4)}%`);
console.log(`  roundness now: ${f.r1.toFixed(4)}% at 1 AU, ${f.r10.toFixed(3)}% at 10, ${f.r30.toFixed(3)}% at 30. Later: ${f.r1b.toFixed(4)}% and ${f.r30b.toFixed(3)}%`);
check('the field is round within 1% at 1 AU', f.r1 < 1, f.r1.toFixed(4));
// A drawn test of the two dip settings: true strength must be very nearly round on screen; enlarged must show a dip.
const dipTest = await p.evaluate(() => { const F = window.fabric, planets = F.BODIES.map((q) => { const o = F.orbitAt(q, 0); return { b: q, x: o.x, y: o.y, r: o.r }; }), j = planets[4], u = Math.hypot(j.x, j.y), far = [-j.x, -j.y]; F.setDips('true'); const t = F.heightAt(j.x * 1.03, j.y * 1.03, planets) - F.heightAt(far[0] * 1.03, far[1] * 1.03, planets); F.setDips('big'); const e = F.heightAt(j.x, j.y, planets) - F.heightAt(far[0], far[1], planets); return { t, e }; });
check('enlarged shows a clear dip at Jupiter', dipTest.e < -0.05, dipTest.e.toFixed(3));
check('true strength leaves only a slight one', Math.abs(dipTest.t) < 0.05, dipTest.t.toFixed(4));

// The slow setting: one day in 6 seconds, spinning at the true rate, and moving about 1 degree along the orbit each day.
await p.click('#time-slow');
const slow = await p.evaluate(() => { const F = window.fabric, a = F.seasonAt(100), c = F.seasonAt(101); return { perSec: F.state.daysPerSec, spin: F.spinPerDay(), orbit: Math.abs(c.lon - a.lon) * 180 / Math.PI }; });
check('slow time runs one day in 6 seconds', Math.abs(slow.perSec - 1 / 6) < 1e-9, slow.perSec.toFixed(4));
check('Earth spins its true 361 degrees a day at that speed', Math.abs(slow.spin - 360.9856) < 1e-3, slow.spin.toFixed(3));
check('Earth moves about 1 degree along its orbit a day', slow.orbit > 0.9 && slow.orbit < 1.05, slow.orbit.toFixed(3));
const ratio = slow.spin / slow.orbit;
check('so it spins hundreds of times faster than it goes around', ratio > 300, ratio.toFixed(0));
await p.evaluate(() => { window.fabric.state.days = 172; }); await new Promise((r) => setTimeout(r, 500));
const follow = await p.evaluate(() => { const F = window.fabric, c = F.followCam, THREE3 = window.THREE, sun = F.distantSun.getWorldPosition(new THREE3.Vector3()), seen = (w) => { const v = w.clone().project(c); return Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1; }; return { earth: seen(new THREE3.Vector3()), sun: seen(sun), dist: c.position.length(), away: sun.length() }; });
check('the following camera has Earth in frame', follow.earth);
check('and the Sun in frame', follow.sun);
check('the camera stays with Earth', follow.dist < 7, follow.dist.toFixed(2));
if (out) { await p.evaluate(() => { window.fabric.state.playing = true; }); await new Promise((r) => setTimeout(r, 1500)); await p.screenshot({ path: path.join(out, 'fabric-slow.png') }); await p.evaluate(() => { window.fabric.state.playing = false; }); }
await p.click('#time-fast');
check('whole-system time goes back to the fast speed', await p.evaluate(() => window.fabric.state.daysPerSec === 30));
// The galaxy. Standard directions in, measured angles out: 60.2 and 59.6 were worked out separately earlier from galactic coordinates of the ecliptic pole.
const g = await p.evaluate(() => { const F = window.fabric; const s = []; for (let d = 0; d < 366; d += 1) s.push(F.earthMotion(d)); const axes = [F.G_NORTH, F.G_TRAVEL, F.G_CENTER], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return { plane: F.planeTilt, path: F.pathTilt, auYear: F.AU_PER_YEAR, galYear: F.GAL_YEAR_MY, lo: Math.min(...s.map((x) => x.speed)), hi: Math.max(...s.map((x) => x.speed)), aheadHi: Math.max(...s.map((x) => x.ahead)), aheadLo: Math.min(...s.map((x) => x.ahead)), ortho: Math.max(Math.abs(dot(axes[0], axes[1])), Math.abs(dot(axes[0], axes[2])), Math.abs(dot(axes[1], axes[2]))), view: F.state.view }; });
console.log('  galaxy', JSON.stringify(g));
check('the page opens going through the galaxy', g.view === 'galaxy');
check('orbital plane against the galactic plane is 60.2, as found earlier', Math.abs(g.plane - 60.2) < 0.1, g.plane.toFixed(2));
check('orbital plane against the Sun\'s path is 59.6, as found earlier', Math.abs(g.path - 59.6) < 0.2, g.path.toFixed(2));
check('the galaxy\'s axes are square to each other', g.ortho < 1e-3, g.ortho.toExponential(1));
check('the Sun covers 48.5 AU a year, by hand: 230 km/s', Math.abs(g.auYear - 48.5) < 0.1, g.auYear.toFixed(2));
check('a trip around the galaxy takes roughly 220 million years', g.galYear > 200 && g.galYear < 240, g.galYear.toFixed(0));
check('Earth runs about 215 to 245 km/s through the galaxy, never backward', g.lo > 212 && g.lo < 218 && g.hi > 242 && g.hi < 248, `${g.lo.toFixed(1)} to ${g.hi.toFixed(1)}`);
check('Earth swings about 0.5 AU ahead of and behind the Sun', g.aheadHi > 0.45 && g.aheadHi < 0.6 && g.aheadLo < -0.45 && g.aheadLo > -0.6, `${g.aheadLo.toFixed(2)} to ${g.aheadHi.toFixed(2)}`);
const coil = await p.evaluate(() => { const F = window.fabric, b = F.BODIES[2], V = window.THREE.Vector3, a = F.coilPoint(b, 0, new V()), c = F.coilPoint(b, 365.25 * 1.00002, new V()); const slowGap = a.distanceTo(c), per = F.unitsPerYear(); F.setTravel('true'); const a2 = F.coilPoint(b, 0, new V()), c2 = F.coilPoint(b, 365.25 * 1.00002, new V()), trueGap = a2.distanceTo(c2), screenPerAU = F.toScreen(36) / 36, nearly = trueGap / screenPerAU; const scale = F.state.scale; F.setTravel('slow'); F.setScale('squeezed'); return { slowGap, per, nearly, scale }; });
check('one year on, Earth is one travel-step further along', Math.abs(coil.slowGap - coil.per) < 1e-3, coil.slowGap.toFixed(3));
check('at the true ratio that step is 48.5 AU at true scale', Math.abs(coil.nearly - 48.5) < 0.1 && coil.scale === 'true', coil.nearly.toFixed(2));
check('the tilt was applied to the drawing', await p.evaluate(() => { const F = window.fabric, up = new window.THREE.Vector3(0, 1, 0).applyMatrix4(F.toGalaxy); return Math.abs(Math.acos(up.y) * 180 / Math.PI - 60.2) < 0.1; }));
// Flattening the funnel: heights go away, and nothing about where the planets are or how strong the field is changes.
const flat = await p.evaluate(() => { const F = window.fabric, P = F.BODIES.map((q) => { const o = F.orbitAt(q, 500); return { b: q, x: o.x, y: o.y, r: o.r }; }), read = () => ({ h: F.heightAt(1, 0, P), orbit: F.orbitAt(F.BODIES[2], 500).r, field: F.field(1, 0, 500) }); const full = read(); F.state.relief = 0; const none = read(); F.state.relief = 1; return { full, none }; });
check('the funnel has real height at full depth', flat.full.h < -0.5, flat.full.h.toFixed(3));
check('flattened, the height is gone', Math.abs(flat.none.h) < 0.01, flat.none.h.toFixed(4));
check('flattening moves no planet and changes no field number', flat.full.orbit === flat.none.orbit && flat.full.field === flat.none.field);
// The spiral: its own shape, that it flows inward, and that it does not change the physics.
const opensPlain = await p.evaluate(() => window.fabric.state.shape === 'funnel' && !window.fabric.flow.visible);
check('the page opens with no spiral drawn flat on the disc', opensPlain);
const perp = await p.evaluate(() => { const F = window.fabric, V = window.THREE.Vector3, n = new V(0, 1, 0).applyMatrix4(F.toGalaxy).normalize(), real = F.offPerpendicular(), b = F.BODIES[2], y = 365.25 * 1.00002; F.setPath('perp'); const a = F.coilPoint(b, 0, new V()), c = F.coilPoint(b, y, new V()), straight = Math.abs(c.clone().sub(a).normalize().dot(n)); F.setPath('real'); const a2 = F.coilPoint(b, 0, new V()), c2 = F.coilPoint(b, y, new V()), measured = Math.acos(Math.abs(c2.clone().sub(a2).normalize().dot(n))) * 180 / Math.PI; return { real, straight, measured }; });
check('the coils run 30.4 degrees from perpendicular, by hand: 90 - 59.6', Math.abs(perp.real - 30.4) < 0.1, perp.real.toFixed(2));
check('measured from the drawn coil itself, year to year', Math.abs(perp.measured - 30.4) < 0.1, perp.measured.toFixed(2));
check('the comparison path really is straight out of the disc', Math.abs(perp.straight - 1) < 1e-6, perp.straight.toFixed(6));
const worldline = await p.evaluate(() => { const F = window.fabric, V = window.THREE.Vector3, b = F.BODIES[2], y = 365.25 * 1.00002; F.setPath('perp'); F.setTravel('true'); const a = F.coilPoint(b, 0, new V()), c = F.coilPoint(b, y, new V()), au = a.distanceTo(c) / (F.toScreen(36) / 36), label = document.getElementById('field-note').textContent; F.setTravel('slow'); F.setScale('squeezed'); F.setPath('real'); return { au, label }; });
check('at true scale, one year along time is one light year: 63,241 AU', Math.abs(worldline.au - 63241 * 1.00002) < 5, worldline.au.toFixed(0));
check('the page names that scale', /63,241 AU/.test(worldline.label));
await p.click('#shape-spiral');
// The page draws on its next animation frame, so give it up to two seconds to show the spiral, as a person would see it.
await p.waitForFunction(() => window.fabric.armLines.some((l) => l.visible) && window.fabric.flow.visible, { timeout: 2000 }).catch(() => {});
const sp2 = await p.evaluate(() => { const F = window.fabric; return { perTurn: Math.exp(2 * Math.PI / ((F.armAngle(1, 0) - F.armAngle(Math.E, 0)))), inwardGrows: F.armAngle(0.5, 0) > F.armAngle(5, 0), shape: F.state.shape, arms: F.armLines.filter((l) => l.visible).length, flowOn: F.flow.visible }; });
check("the flat spiral appears when asked for", sp2.shape === "spiral" && sp2.arms === 6 && sp2.flowOn, JSON.stringify({shape: sp2.shape, arms: sp2.arms, flowOn: sp2.flowOn}));
check('a logarithmic spiral: one constant ratio of 6.5 per turn', Math.abs(sp2.perTurn - 6.5) < 1e-6, sp2.perTurn.toFixed(3));
check('going inward it turns the way the planets travel', sp2.inwardGrows);
const flowed = await p.evaluate(async () => { const F = window.fabric, before = F.flowU.slice(); F.state.playing = true; await new Promise((r) => setTimeout(r, 500)); F.state.playing = false; const moved = F.flowU.filter((u, n) => u !== before[n]).length, inward = F.flowU.filter((u, n) => u > before[n]).length; return { moved, inward, total: before.length }; });
check('the flow moves inward toward the Sun', flowed.moved > 0 && flowed.inward >= flowed.moved * 0.95, `${flowed.inward} of ${flowed.total}`);
const held = await p.evaluate(() => { const F = window.fabric, r0 = F.orbitAt(F.BODIES[2], 365.25 * 2).r, f0 = F.field(1, 0, 10); F.setShape('funnel'); const r1 = F.orbitAt(F.BODIES[2], 365.25 * 2).r, f1 = F.field(1, 0, 10), noGroove = F.groove(1, 1); F.setShape('spiral'); return { same: r0 === r1 && f0 === f1, noGroove, grooveOn: F.groove(1, F.armAngle(1, 0)) }; });
check('the spiral changes no orbit and no field number', held.same);
check('the funnel view has no groove, the spiral view does', held.noGroove === 0 && held.grooveOn < 0, String(held.grooveOn));
const planetsStay = await p.evaluate(() => { const F = window.fabric; return F.BODIES.every((q) => { let lo = 1e9, hi = 0; for (let d = 0; d < q.year * 365.25; d += q.year * 5) { const r = F.orbitAt(q, d + 365.25 * 400).r; lo = Math.min(lo, r); hi = Math.max(hi, r); } return lo > q.a * (1 - q.e) * 0.99 && hi < q.a * (1 + q.e) * 1.01; }); });
check('planets keep to their orbits and do not fall in', planetsStay);
check('the page says the flat spiral is a depiction', await p.evaluate(() => /drawn onto/.test(document.getElementById('field-note').textContent) && /drawn onto/.test(document.getElementById('round').textContent)));
await p.click('#shape-funnel');
await new Promise((r) => setTimeout(r, 800));
const rowsOk = await p.evaluate(() => [...document.querySelectorAll('#rows tr')].length === 8 && document.querySelector('#rows td:nth-child(3)').textContent !== '');
check('the planet table is filled', rowsOk);
check('the round reading is on the page', await p.evaluate(() => /close to round/.test(document.getElementById('round').textContent)));
check('no long dashes', await p.evaluate(() => !/[\u2013\u2014]/.test(document.body.innerText)));
if (out) { await p.evaluate(() => { window.fabric.state.days = 172; }); await new Promise((r) => setTimeout(r, 700)); await p.screenshot({ path: path.join(out, 'fabric-desktop.png') }); await p.click('#dips-true'); await new Promise((r) => setTimeout(r, 700)); await p.screenshot({ path: path.join(out, 'fabric-true.png') }); await p.click('#path-perp'); await new Promise((r) => setTimeout(r, 700)); await p.screenshot({ path: path.join(out, 'fabric-perp.png') }); await p.click('#path-real'); await p.click('#dips-big'); }
check('no page errors or failed loads', errors.length === 0, errors.slice(0, 3).join(' | '));
await p.setViewport({ width: 400, height: 800, isMobile: true, hasTouch: true }); await new Promise((r) => setTimeout(r, 900));
check('the page really is at phone width', await p.evaluate(() => innerWidth) === 400, String(await p.evaluate(() => innerWidth)));
check('nothing runs off the side on a phone', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), String(await p.evaluate(() => document.documentElement.scrollWidth)));
if (out) await p.screenshot({ path: path.join(out, 'fabric-phone.png'), fullPage: true });
await b.close(); fs.unlinkSync(temp);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
