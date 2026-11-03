// Descarga de realzaragoza.com las fichas de los partidos del Real Zaragoza ya jugados (o en juego)
// y actualiza data/official.json. Solo lee páginas públicas de partidos (robots.txt las permite)
// y solo pide las que faltan o no están cerradas, con pausa entre peticiones.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseOfficial } = require('./official_parser.js');

const ROOT = new URL('../', import.meta.url);
const UA = 'Mozilla/5.0 (compatible; NoblezaYValor/1.0; app personal de estadisticas)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJSON = async p => JSON.parse(await readFile(new URL(p, ROOT), 'utf8'));

async function getNextData(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  const html = await r.text();
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No encuentro __NEXT_DATA__ en ' + url);
  return JSON.parse(m[1]);
}

const idx = await readJSON('data/official_index.json');
const season = await readJSON('data/season.json');
let off; try { off = await readJSON('data/official.json'); } catch { off = { matches: {} }; }
const force = new Set((process.env.FORCE_J || '').split(',').filter(Boolean));

// fecha de cada jornada del Zaragoza (calendario RFEF) y fecha real si ya la tenemos
const today = new Date();
const dueJ = Object.keys(idx.league).map(Number).filter(j => {
  if (force.has(String(j))) return true;
  const known = off.matches[j];
  if (known && known.finished) return false;
  const fx = season.fixtures.find(f => f.j === j && (f.h === 'ZAR' || f.a === 'ZAR'));
  const d = new Date((known && known.time) || (fx && fx.date + 'T23:59:00Z'));
  // jornada cuya fecha (nominal o real) ya ha llegado, con 3 días de margen por adelantos
  return d.getTime() - 3 * 864e5 <= today.getTime();
}).sort((a, b) => a - b);

let changed = 0;
for (const j of dueJ) {
  const url = idx.base + idx.league[j];
  try {
    const m = parseOfficial(await getNextData(url));
    const before = JSON.stringify(off.matches[j] || null);
    off.matches[j] = m;
    if (before !== JSON.stringify(m)) { changed++; console.log(`J${j}: ${m.home} ${m.hs ?? ''}-${m.as ?? ''} ${m.away} · ${m.finished ? 'final' : m.period}`); }
    else console.log(`J${j}: sin cambios`);
  } catch (e) { console.error(`J${j}: ${e.message}`); }
  await sleep(2500);
}
if (changed) {
  off.updated = new Date().toISOString();
  off.source = 'realzaragoza.com (fichas de partido)';
  await writeFile(new URL('data/official.json', ROOT), JSON.stringify(off));
}
console.log(changed ? `Actualizados ${changed} partidos` : 'Nada nuevo');
