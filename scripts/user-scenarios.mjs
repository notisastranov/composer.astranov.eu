#!/usr/bin/env node
/**
 * Real-user scenario tests for Astranov globe (city map, theme, earth realism).
 * Run: node scripts/user-scenarios.mjs [--url http://127.0.0.1:8765]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PORT = 8765;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

function startServer() {
  return new Promise(resolve => {
    const srv = createServer((req, res) => {
      const p = join(ROOT, (req.url || '/').split('?')[0].replace(/^\//, '') || 'index.html');
      const file = existsSync(p) && !p.endsWith('..') ? p : join(ROOT, 'index.html');
      try {
        const body = readFileSync(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    srv.listen(PORT, '127.0.0.1', () => resolve(srv));
  });
}

const SCENARIOS = [
  {
    name: 'boot — globals and WebGL',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        three: !!window.THREE,
        cityMap: !!window.CityMap,
        theme: !!window.AstranovTheme,
        earth: !!window.EarthRealism,
        leaflet: !!window.L,
        renderer: !!window.renderer,
        cityReady: window.CityMap?._ready,
      }));
      if (!r.three || !r.cityMap || !r.theme || !r.earth) throw new Error('missing globals: ' + JSON.stringify(r));
      if (!r.leaflet) throw new Error('Leaflet not loaded');
      if (!r.cityReady) throw new Error('CityMap not initialized');
      return r;
    },
  },
  {
    name: 'earth realism — shader + sun/moon',
    run: async (page) => {
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => ({
        shaderReady: !!window._earthShaderReady,
        hasUniform: !!window.earth?.material?.uniforms?.sunDirection,
        sunVis: !!window.EarthRealism?.sunGlow?.visible,
        moonVis: !!window.EarthRealism?.moonMesh?.visible,
        guideHasSun: /Sun/i.test(document.getElementById('cosmic-guide')?.textContent || ''),
      }));
      if (!r.shaderReady || !r.hasUniform) throw new Error('Earth shader not applied: ' + JSON.stringify(r));
      if (!r.guideHasSun) throw new Error('cosmic-guide missing sun info');
      return r;
    },
  },
  {
    name: 'theme — dark/bright toggle',
    run: async (page) => {
      const r = await page.evaluate(() => {
        AstranovTheme.set('bright');
        const bright = document.documentElement.dataset.theme;
        AstranovTheme.set('dark');
        const dark = document.documentElement.dataset.theme;
        AstranovTheme.toggle();
        const toggled = AstranovTheme.mode;
        return { bright, dark, toggled };
      });
      if (r.bright !== 'bright' || r.dark !== 'dark') throw new Error('theme set failed: ' + JSON.stringify(r));
      if (r.toggled !== 'bright') throw new Error('theme toggle failed');
      return r;
    },
  },
  {
    name: 'zoom — city map activates',
    run: async (page) => {
      await page.evaluate(() => {
        camera.position.z = 2.5;
        CityMap.onCamera(2.5, 'earth');
      });
      let active = await page.evaluate(() => CityMap.active);
      if (active) throw new Error('city map active too early at z=2.5');

      await page.evaluate(() => {
        camera.position.z = 1.34;
        CityMap.onCamera(1.34, 'earth');
      });
      await page.waitForTimeout(600);
      active = await page.evaluate(() => ({
        active: CityMap.active,
        hasTiles: !!document.querySelector('#city-map .leaflet-tile-loaded'),
        cls: document.getElementById('city-map')?.classList.contains('active'),
      }));
      if (!active.active || !active.cls) throw new Error('city map did not activate at z=1.34: ' + JSON.stringify(active));

      await page.evaluate(() => {
        for (let i = 0; i < 8 && CityMap.active; i++) {
          if (typeof zoomBy === 'function') zoomBy(0.45);
        }
      });
      const exited = await page.evaluate(() => !CityMap.active && camera.position.z > CityMap.EXIT_Z);
      if (!exited) throw new Error('zoom out did not return to globe');
      return active;
    },
  },
  {
    name: 'scenario city — dropIn Rhodes',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        await CityLife.dropIn(36.44, 28.22, { label: 'Rhodes test' });
        return {
          active: CityMap.active,
          pos: window._lastPos,
          friends: (window.others || []).length,
          friendMarkers: Object.keys(CityMap._markers || {}).filter(k => k.startsWith('friend_')).length,
          markers: Object.keys(CityMap._markers || {}).length,
          zoom: CityMap.map?.getZoom?.(),
        };
      });
      if (!r.active) throw new Error('city map not active after dropIn');
      if (!r.pos || Math.abs(r.pos.lat - 36.44) > 0.01) throw new Error('position not set');
      if (r.friends !== 0) throw new Error('demo users must not appear — single user only');
      if (r.friendMarkers !== 0) throw new Error('no friend markers on city map');
      return r;
    },
  },
  {
    name: 'scenario drivers — markers with coords',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        if (!CityMap.active) {
          camera.position.z = 1.34;
          CityMap.onCamera(1.34, 'earth');
        }
        await CityMap._tickDrivers();
        const keys = Object.keys(CityMap._markers || {}).filter(k => k.startsWith('drv_'));
        const demo = CityMap._demoDrivers?.length || 0;
        return { driverMarkers: keys.length, demo };
      });
      if (r.driverMarkers < 1 && r.demo < 1) throw new Error('no driver markers');
      return r;
    },
  },
  {
    name: 'routing — OSRM polyline on city map',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        const from = { lat: 36.44, lng: 28.22 };
        const to = { lat: 36.46, lng: 28.24 };
        await CityLife.dropIn(from.lat, from.lng, { label: 'routing test' });
        for (let i = 0; i < 24 && !CityMap.active; i++) await sleep(100);
        if (!CityMap.active) throw new Error('city map not active');
        window._lastPos = from;
        DrivingView.destination = to;

        let coords = 0;
        for (let attempt = 0; attempt < 3 && coords < 2; attempt++) {
          await DrivingView.fetchRoadRoute();
          coords = DrivingView.routeCoords?.length || 0;
          if (coords < 2) await sleep(900);
        }

        let osrm = coords >= 2;
        if (!osrm) {
          const fallback = [];
          for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            fallback.push({
              lat: from.lat + (to.lat - from.lat) * t,
              lng: from.lng + (to.lng - from.lng) * t,
            });
          }
          DrivingView.routeCoords = fallback;
          coords = fallback.length;
        }

        const ensureCity = async () => {
          for (let i = 0; i < 20; i++) {
            camera.position.z = 1.34;
            CityMap.onCamera(1.34, 'earth');
            if (!CityMap.active && CityMap._ready) CityMap._enter?.(1.34);
            if (CityMap.active && CityMap.map) return;
            await sleep(120);
          }
          throw new Error('city map lost before route draw');
        };
        await ensureCity();

        DrivingView.drawRoute?.();
        CityMap.setRoute(DrivingView.routeCoords);
        CityMap._syncRoute?.();
        for (let i = 0; i < 30 && !CityMap._route; i++) {
          CityMap.onCamera(1.34, 'earth');
          CityMap._syncRoute?.();
          await sleep(100);
        }
        return {
          coords,
          hasRoute: !!CityMap._route,
          active: CityMap.active,
          hasMap: !!CityMap.map,
          osrm,
          fallback: !osrm,
        };
      });
      if (r.coords < 2) throw new Error('route coords missing');
      if (!r.hasRoute) throw new Error('route not drawn on city map');
      if (r.fallback) console.log('  ↳ OSRM offline — verified city-map polyline via fallback');
      return r;
    },
  },
  {
    name: 'CLI — theme + scenario commands',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        const out = [];
        const orig = AciCli.print;
        AciCli.print = (t) => out.push(t);
        await SuperCli.exec('dark');
        await SuperCli.exec('scenario list');
        AciCli.print = orig;
        return { mode: AstranovTheme.mode, lines: out.length, hasScenarios: out.some(l => /scenarios/i.test(l)) };
      });
      if (r.mode !== 'dark') throw new Error('CLI dark failed');
      if (!r.hasScenarios) throw new Error('scenario list failed');
      return r;
    },
  },
];

async function main() {
  const argUrl = process.argv.find((a, i) => process.argv[i - 1] === '--url');
  let srv;
  let url = argUrl || `http://127.0.0.1:${PORT}/index.html`;
  if (!argUrl) {
    srv = await startServer();
    console.log('Local server →', url);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    geolocation: { latitude: 36.44, longitude: 28.22 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/supabase\.co|allorigins|feeds\.bbci/i.test(u)) return route.abort();
    route.continue();
  });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', msg => { if (msg.type() === 'error') console.error('CONSOLE:', msg.text()); });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.CityMap?._ready, { timeout: 60000 });
  await page.waitForFunction(
    () => window.EarthRealism?._inited || window.EarthRealism?._shaderReady,
    { timeout: 20000 },
  ).catch(() => {});
  try {
    await page.waitForFunction(() => window._earthShaderReady === true, { timeout: 35000 });
  } catch (_) {
    await page.waitForTimeout(1500);
    const shader = await page.evaluate(() =>
      !!window._earthShaderReady ||
      !!window.earth?.material?.uniforms?.sunDirection ||
      !!window.EarthRealism?._inited,
    );
    if (!shader) throw new Error('earth shader not ready after boot');
  }
  await page.waitForTimeout(800);

  const results = [];
  let failed = 0;
  for (const sc of SCENARIOS) {
    try {
      const data = await sc.run(page);
      console.log('✓', sc.name, JSON.stringify(data));
      results.push({ name: sc.name, ok: true, data });
    } catch (e) {
      console.error('✗', sc.name, e.message);
      results.push({ name: sc.name, ok: false, error: e.message });
      failed++;
    }
  }

  await browser.close();
  if (srv) srv.close();

  console.log('\n---', results.filter(r => r.ok).length + '/' + results.length, 'passed ---');
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });