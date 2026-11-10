/* Nobleza y valor · seguimiento estadístico del Real Zaragoza 26/27 (app personal, no oficial) */
'use strict';

const LS_USER = 'rz2627_user';
const LS_CFG = 'rz2627_cfg';
const LS_THEME = 'rz2627_theme';
const WORKFLOW = 'datos-oficiales.yml';
const S = { season: null, history: null, squad: null, official: { matches: {} }, user: null, cfg: {}, charts: {}, view: 'inicio', champMode: 'last4', compare: [], sortBy: 'min', posFilter: 'ALL' };

const CHAMP_COLORS = { 'Tenerife': '#ff5a5f', 'Eldense': '#f5b83d', 'Cultural Leonesa': '#3ccf7a', 'Ceuta': '#a77bff', 'Deportivo': '#7aa2ff', 'Castellón': '#8fd14f', 'Racing de Ferrol': '#36b9e6', 'Amorebieta': '#ff8bd1' };
const CHAMP_ABBR = { 'Tenerife': 'TEN', 'Eldense': 'ELD', 'Cultural Leonesa': 'CUL', 'Ceuta': 'CEU', 'Deportivo': 'DEP', 'Castellón': 'CAS', 'Racing de Ferrol': 'RFE', 'Amorebieta': 'AMO' };
const POS_NAME = { POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero', FIL: 'Filial' };
const POS_COLOR = { POR: '#d18b1f', DEF: '#1f8a5f', MED: '#2f6bff', DEL: '#c8364b', FIL: '#7a86a6' };
// nombres usados en la primera versión (actas guardadas antes de los datos oficiales)
const OLD_NAMES = { 'Anartz Pena': 'n13', 'Rubo Iranzo': 'n14', 'Jamelli': 'n19', 'D. Monzón': 'n26', 'M. Manolache': 'n40', 'Jaime Tobajas': 'n31', 'Peter Ademo': 'n6', 'Joaquín Delgado': 'n20' };

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d).replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
function initials(name) { return String(name).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function dateES(iso) { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y.slice(2)}`; }
function dateTimeES(iso) { try { return new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }); } catch { return iso; } }
// «sáb 14 · 21:00» (hora de España) para las filas de la jornada
function kickShort(iso) {
  try {
    const d = new Date(iso), o = { timeZone: 'Europe/Madrid' };
    const wd = d.toLocaleDateString('es-ES', { ...o, weekday: 'short' }).replace('.', '');
    return `${wd} ${d.toLocaleDateString('es-ES', { ...o, day: 'numeric' })} · ${d.toLocaleTimeString('es-ES', { ...o, hour: '2-digit', minute: '2-digit' })}`;
  } catch { return ''; }
}
const sum = (a, f) => a.reduce((s, x) => s + (f(x) || 0), 0);

/* ---------- tema ---------- */
function themePref() { return lsGet(LS_THEME, 'auto'); }
function applyTheme() {
  const t = themePref(), el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  const icon = { auto: '◐', light: '☀︎', dark: '☾' }[t];
  const b = $('#btnTheme'); if (b) { b.textContent = icon; b.title = 'Tema: ' + { auto: 'automático', light: 'claro', dark: 'oscuro' }[t]; }
  const light = isLight();
  $('meta[name=theme-color]').setAttribute('content', light ? '#f4f6fb' : '#0a1430');
  setupChartDefaults();
}
function isLight() { const t = document.documentElement.getAttribute('data-theme'); return t ? t === 'light' : matchMedia('(prefers-color-scheme: light)').matches; }
function C() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  return { zar: v('--c-zar'), zarFill: v('--c-zar-fill'), grid: v('--c-grid'), ink: v('--c-ink'), opp: v('--c-opp'), muted: v('--ink3') };
}

/* ---------- carga de datos ---------- */
async function loadJSON(url, optional = false) {
  try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { if (optional) return null; throw e; }
}
function emptyUser() { return { v: 2, updatedAt: null, results: {}, manual: {}, actas: {}, assists: {}, extra: {}, photos: {}, wikiAt: null }; }

async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (themePref() === 'auto') { applyTheme(); renderAll(); } });
  [S.season, S.history, S.squad] = await Promise.all([loadJSON('data/season.json'), loadJSON('data/history.json'), loadJSON('data/squad.json')]);
  S.official = (await loadJSON('data/official.json', true)) || { matches: {} };
  S.schedule = (await loadJSON('data/schedule.json', true)) || { rfef: {} };
  const remote = await loadJSON('data/user.json', true);
  S.user = migrateUser(pickNewer(remote, lsGet(LS_USER, null)) || emptyUser());
  S.cfg = lsGet(LS_CFG, {});
  bindNav();
  $('#btnUpdate').addEventListener('click', updateAll);
  $('#btnActa').addEventListener('click', () => go('acta'));
  $('#btnTheme').addEventListener('click', () => { const order = ['auto', 'light', 'dark']; lsSet(LS_THEME, order[(order.indexOf(themePref()) + 1) % 3]); applyTheme(); renderAll(); toast($('#btnTheme').title); });
  renderAll();
  const last = S.user.wikiAt ? new Date(S.user.wikiAt).getTime() : 0;
  if (Date.now() - last > 6 * 3600e3) updateFromWikipedia({ silent: true }).catch(() => { });
  if ('serviceWorker' in navigator) {
    // si hay una versión nueva del service worker, recarga una vez para estrenarla
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => { });
  }
}
function pickNewer(a, b) { if (!a) return b; if (!b) return a; return (new Date(a.updatedAt || 0) >= new Date(b.updatedAt || 0)) ? a : b; }
function migrateUser(u) {
  u = { ...emptyUser(), ...u };
  Object.values(u.actas || {}).forEach(a => {
    const k = n => n ? (resolveKey(n) || n) : n;
    a.starters = (a.starters || []).map(k);
    (a.subs || []).forEach(s => { s.out = k(s.out); s.in = k(s.in); });
    (a.goals || []).forEach(g => { g.player = k(g.player); g.assist = k(g.assist); });
    (a.cards || []).forEach(c => { c.player = k(c.player); });
  });
  Object.keys(u.photos || {}).forEach(n => { const k = resolveKey(n); if (k && k !== n) { u.photos[k] = u.photos[n]; delete u.photos[n]; } });
  u.v = 2; return u;
}
function saveUser(syncRemote = true) {
  S.user.updatedAt = new Date().toISOString();
  lsSet(LS_USER, S.user);
  if (syncRemote && S.cfg.token && S.cfg.repo) ghSave().catch(e => toast('No se pudo guardar en GitHub: ' + e.message, 4000));
}

/* ---------- jugadores ---------- */
let _alias = null, _extra = new Map();
function aliasMap() {
  if (_alias) return _alias;
  _alias = new Map();
  S.squad.players.forEach(p => { [p.name, p.short, ...(p.aliases || [])].forEach(n => _alias.set(n.toLowerCase(), p.key)); });
  Object.entries(OLD_NAMES).forEach(([n, k]) => _alias.set(n.toLowerCase(), k));
  return _alias;
}
function resolveKey(name, num) {
  if (!name && num == null) return null;
  if (name && /^n\d+$|^x:/.test(name)) return name;
  const k = name && aliasMap().get(String(name).toLowerCase());
  if (k) return k;
  if (num != null && S.squad.players.some(p => p.n === num)) return 'n' + num;
  const key = 'x:' + name;
  if (!_extra.has(key)) _extra.set(key, { key, n: num ?? null, name, short: name, pos: 'FIL', photo: null, first: false });
  return key;
}
function player(key) { return S.squad.players.find(p => p.key === key) || _extra.get(key) || { key, name: key, short: key, pos: 'FIL' }; }
function allPlayers() { return [...S.squad.players, ..._extra.values()]; }
function photoOf(p) { return S.user.photos[p.key] || p.photo || null; }

/* ---------- modelo de partidos ---------- */
const team = code => S.season.teams.find(t => t.code === code) || { short: code, code, name: code };
const crest = (code, cls = '') => { const t = team(code); return t.shield ? `<img class="crest ${cls}" src="${esc(t.shield)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''; };
const champCrest = (name, cls = '') => { const u = (S.season.champShields || {})[name]; return u ? `<img class="crest ${cls}" src="${esc(u)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''; };
const venueIcon = home => `<span class="vic" title="${home ? 'En casa' : 'Fuera'}">${home ? '🏠' : '✈️'}</span>`;
function official(j) { const m = S.official.matches && S.official.matches[j]; return m && (m.finished || (m.lineups && m.lineups.zar && m.lineups.zar.length)) ? m : null; }
function officialFinal(j) { const m = official(j); return m && m.finished && m.hs != null ? m : null; }
function fixtures() {
  const me = S.season.team;
  return S.season.fixtures.map(f => {
    const k = `${f.h}_${f.a}`, o = S.user.results[k];
    let r = o ? { ...f, hg: o[0], ag: o[1] } : f;
    if (f.h === me || f.a === me) { const m = officialFinal(f.j); if (m) r = { ...r, hg: m.hs, ag: m.as, official: true }; }
    return r;
  });
}
// Hora de inicio: la del club (realzaragoza.com) para el Zaragoza y, para el resto, el cartel de la RFEF
function zarCal(j) { return (S.official.calendar || []).find(m => m.comp === 'liga' && m.j === j) || null; }
function kickoffOf(f) {
  const me = S.season.team;
  if (f.h === me || f.a === me) {
    const c = zarCal(f.j); if (c && c.time) return c.time;
    const om = S.official.matches && S.official.matches[f.j]; if (om && om.time) return om.time;
  }
  const rows = (((S.schedule || {}).rfef || {})[f.j] || {}).rows || [];
  const r = rows.find(x => x.h === f.h && x.a === f.a);
  return r ? r.utc : null;
}
function zarMatches() {
  const me = S.season.team;
  return fixtures().filter(f => f.h === me || f.a === me).sort((a, b) => a.j - b.j).map(f => {
    const home = f.h === me, played = f.hg != null;
    const gf = played ? (home ? f.hg : f.ag) : null, ga = played ? (home ? f.ag : f.hg) : null;
    const res = !played ? null : gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    const om = S.official.matches && S.official.matches[f.j];
    return { ...f, home, opp: home ? f.a : f.h, gf, ga, res, pts: res === 'W' ? 3 : res === 'D' ? 1 : res === 'L' ? 0 : null, kickoff: kickoffOf(f), venue: (om && om.venue) || (zarCal(f.j) || {}).venue };
  });
}
function standings(uptoJ = 99) {
  const T = {};
  S.season.teams.forEach(t => T[t.code] = { code: t.code, pj: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  fixtures().filter(f => f.hg != null && f.j <= uptoJ).sort((a, b) => a.j - b.j).forEach(f => {
    [[f.h, f.hg, f.ag], [f.a, f.ag, f.hg]].forEach(([c, gf, ga]) => {
      const s = T[c]; s.pj++; s.gf += gf; s.ga += ga;
      if (gf > ga) { s.w++; s.pts += 3; s.form.push('W'); } else if (gf === ga) { s.d++; s.pts++; s.form.push('D'); } else { s.l++; s.form.push('L'); }
    });
  });
  return Object.values(T).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || team(a.code).short.localeCompare(team(b.code).short)).map((s, i) => ({ ...s, pos: i + 1 }));
}
function lastRound() { const z = zarMatches().filter(m => m.res); return z.length ? Math.max(...z.map(m => m.j)) : 0; }
function zarCumulative() { let a = 0; return zarMatches().filter(m => m.res).map(m => (a += m.pts)); }
function positionsByRound() { const n = lastRound(), out = []; for (let j = 1; j <= n; j++) out.push(standings(j).find(s => s.code === S.season.team).pos); return out; }

/* Detalle unificado de un partido del Zaragoza: oficial si existe, si no el acta manual */
function matchDetail(j) {
  const om = official(j);
  if (om) {
    const lu = om.lineups.zar, ev = om.events.filter(e => e.side === 'ZAR');
    const num = n => (lu.find(p => p.name === n) || {}).n;
    const key = n => n ? resolveKey(n, num(n)) : null;
    const goals = ev.filter(e => e.t === 'goal').map((e, i) => ({ player: e.kind === 'og' ? null : key(e.player), ogBy: e.kind === 'og' ? e.player : null, assist: (S.user.assists[j] || {})[i] || null, min: e.min, pen: e.kind === 'pen', og: e.kind === 'og' }));
    return {
      source: 'official', j, len: 90,
      starters: lu.filter(p => p.start).map(p => key(p.name)), bench: lu.filter(p => !p.start).map(p => key(p.name)), captain: key((lu.find(p => p.cap) || {}).name),
      subs: ev.filter(e => e.t === 'sub').map(e => ({ out: key(e.out), in: key(e.in), min: e.min })),
      goals, cards: ev.filter(e => e.t === 'card').map(e => ({ player: key(e.player), type: e.card, min: e.min })),
      oppGoals: om.events.filter(e => e.t === 'goal' && e.side === 'OPP').map(e => ({ player: e.player, min: e.min, pen: e.kind === 'pen', og: e.kind === 'og' })),
      oppCards: om.events.filter(e => e.t === 'card' && e.side === 'OPP'), oppSubs: om.events.filter(e => e.t === 'sub' && e.side === 'OPP'),
      stats: om.stats, xg: (S.user.extra[j] || {}).xg, meta: om
    };
  }
  const a = S.user.actas[j];
  if (a) return { source: 'acta', j, len: +a.len || 90, starters: a.starters || [], bench: [], subs: a.subs || [], goals: a.goals || [], cards: a.cards || [], oppGoals: [], stats: a.stats && Object.keys(a.stats).length ? { zar: actaStats(a.stats, 'z'), opp: actaStats(a.stats, 'o') } : null, xg: a.stats && a.stats.xg };
  return null;
}
function actaStats(st, s) { const m = { pos: 'possessionPercentage', shots: 'totalScoringAtt', sot: 'ontargetScoringAtt', corners: 'cornerTaken', fouls: 'fouls', tackles: 'totalTackle' }, o = {}; Object.entries(m).forEach(([k, v]) => { if (st[k] && st[k][s] != null) o[v] = st[k][s]; }); return o; }
function minutesOf(d) {
  const len = d.len || 90, out = {};
  (d.starters || []).forEach(n => out[n] = { min: len, start: true, from: 0 });
  (d.subs || []).forEach(s => {
    const m = Math.min(len, +s.min);
    if (s.out && out[s.out]) out[s.out].min = Math.max(0, m - out[s.out].from);
    if (s.in) out[s.in] = { min: Math.max(0, len - m), start: false, from: m };
  });
  (d.cards || []).filter(c => c.type === 'R' || c.type === 'YR').forEach(c => { const p = out[c.player]; if (p) p.min = Math.max(0, Math.min(p.from + p.min, Math.min(len, +c.min)) - p.from); });
  Object.values(out).forEach(p => p.min = Math.round(p.min));
  return out;
}
function playerTotals() {
  const AB = S.squad.assistsBase || { upto: 0, byKey: {} };
  const map = new Map();
  const get = k => { if (!map.has(k)) { const p = player(k); map.set(k, { ...p, min: 0, pj: 0, pt: 0, g: 0, a: 0, y: 0, r: 0, pen: 0, log: [] }); } return map.get(k); };
  S.squad.players.filter(p => p.first).forEach(p => get(p.key));
  zarMatches().filter(m => m.res).forEach(m => {
    const d = matchDetail(m.j); if (!d) return;
    const mins = minutesOf(d);
    Object.entries(mins).forEach(([k, x]) => { const p = get(k); p.min += x.min; p.pj++; if (x.start) p.pt++; p.log.push({ j: m.j, opp: m.opp, res: m.res, min: x.min, start: x.start, g: 0, a: 0, y: 0, r: 0 }); });
    const L = (k) => { const p = get(k); let e = p.log.find(x => x.j === m.j); if (!e) { e = { j: m.j, opp: m.opp, res: m.res, min: 0, start: false, g: 0, a: 0, y: 0, r: 0 }; p.log.push(e); } return [p, e]; };
    d.goals.forEach(g => {
      if (g.player && !g.og) { const [p, e] = L(g.player); p.g++; e.g++; if (g.pen) p.pen++; }
      if (g.assist && m.j > AB.upto) { const [p, e] = L(g.assist); p.a++; e.a++; }
    });
    d.cards.forEach(c => {
      const [p, e] = L(c.player);
      if (c.type === 'Y') { p.y++; e.y++; return; }
      // doble amarilla: la 1ª amarilla ya suele venir aparte; si no viene, la contamos
      if (c.type === 'YR' && !d.cards.some(x => x.player === c.player && x.type === 'Y')) { p.y++; e.y++; }
      p.r++; e.r++;
    });
  });
  Object.entries(AB.byKey || {}).forEach(([k, n]) => { get(k).a += n; });
  return [...map.values()].map(p => ({ ...p, photo: photoOf(p), ga: p.g + p.a }));
}
function teamStats() {
  const rows = zarMatches().filter(m => m.res).map(m => { const d = matchDetail(m.j); return d && d.stats && d.stats.zar ? { j: m.j, m, z: d.stats.zar, o: d.stats.opp || {} } : null; }).filter(Boolean);
  return rows;
}

/* ---------- navegación ---------- */
function bindNav() {
  $$('#tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  const h = location.hash.replace('#', ''); if (h && $('#view-' + h)) go(h, false);
}
function go(v, render = true) {
  S.view = v; history.replaceState(null, '', '#' + v);
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (render) renderView(v);
}
function renderAll() { renderView(S.view); }
function renderView(v) { ({ inicio: rInicio, temporada: rTemporada, estadisticas: rEstadisticas, campeones: rCampeones, micro: rMicro, plantilla: rPlantilla, acta: rActa })[v](); }

/* ---------- gráficos ---------- */
function setupChartDefaults() {
  if (!window.Chart) return;
  const c = C();
  Chart.defaults.color = c.ink;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = isLight() ? '#0d1a3a' : '#ffffff';
  Chart.defaults.plugins.tooltip.titleColor = isLight() ? '#ffffff' : '#0a1430';
  Chart.defaults.plugins.tooltip.bodyColor = isLight() ? '#ffffff' : '#0a1430';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 500;
}
function chart(id, cfg) {
  if (!window.Chart) return null;
  if (S.charts[id]) S.charts[id].destroy();
  const el = document.getElementById(id); if (!el) return null;
  return (S.charts[id] = new Chart(el, cfg));
}
const jLabels = n => Array.from({ length: n }, (_, i) => 'J' + (i + 1));
const gridY = (extra = {}) => ({ grid: { color: C().grid }, ...extra });
const noGrid = (extra = {}) => ({ grid: { display: false }, ...extra });

/* ---------- INICIO ---------- */
function rInicio() {
  const c = C();
  const ms = zarMatches(), played = ms.filter(m => m.res), st = standings(), me = st.find(s => s.code === S.season.team);
  const n = played.length, ppg = n ? me.pts / n : 0, proj = ppg * 38;
  const next = ms.find(m => !m.res);
  const form = played.slice(-5);
  const home = played.filter(m => m.home), away = played.filter(m => !m.home);
  const cs = played.filter(m => m.ga === 0).length;
  const leader = st[0], second = st[1], sixth = st[5];
  const gapTop = me.pos === 1 ? me.pts - second.pts : me.pts - leader.pts;
  const gap6 = me.pts - sixth.pts;
  const B = microBlocks(), blk = B.find(b => b.status === 'live') || B.filter(b => b.played).slice(-1)[0];
  const champs = S.history.seasons;
  const avgChampAtN = n ? champs.reduce((s, x) => s + x.curve[n - 1], 0) / champs.length : 0;
  const P = playerTotals(), top = [...P].sort((a, b) => b.g - a.g || b.a - a.a)[0], topMin = [...P].sort((a, b) => b.min - a.min)[0];

  $('#view-inicio').innerHTML = `
  <div class="hero">
    <div class="hero-top">
      <div>
        <div class="lbl">Posición · Jornada ${n}</div>
        <div class="pos">${me.pos}<sup>º</sup></div>
        <div class="lbl" style="margin-top:6px">${me.pos === 1 ? 'Líder · +' + gapTop + ' sobre el 2º' : (gapTop === 0 ? 'Empatado con el líder' : gapTop + ' pts del líder')}</div>
      </div>
      <div style="text-align:right">
        <div class="lbl">Últimos 5</div>
        <div class="form" style="margin-top:6px;justify-content:flex-end">${form.map(m => `<b class="${m.res}">${{ W: 'V', D: 'E', L: 'D' }[m.res]}</b>`).join('')}</div>
        <div class="lbl" style="margin-top:14px">Proyección</div>
        <div class="display" style="font-size:40px;line-height:1">${fmt(proj, 1)} <span style="font-size:18px">pts</span></div>
      </div>
    </div>
    <div class="hero-stats">
      <div><b>${me.pts}</b><span>Puntos</span></div>
      <div><b>${me.w}-${me.d}-${me.l}</b><span>V-E-D</span></div>
      <div><b>${me.gf}:${me.ga}</b><span>Goles</span></div>
      <div><b>${fmt(ppg, 2)}</b><span>Pts/partido</span></div>
    </div>
  </div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card">
      <h3>Próximo partido</h3>
      ${next ? `<div class="sub">Jornada ${next.j} · ${next.kickoff ? dateTimeES(next.kickoff) : dateES((zarCal(next.j) || {}).date || next.date) + ' · hora por confirmar'} · ${next.home ? '🏠 Ibercaja Estadio' : '✈️ ' + esc(team(next.opp).city) + ' · ' + esc(team(next.opp).stadium)}</div>
      <div class="next">
        <div class="team">${badge(next.home ? 'ZAR' : next.opp)}${esc(next.home ? 'Real Zaragoza' : team(next.opp).name)}</div>
        <div class="vs">VS</div>
        <div class="team">${badge(next.home ? next.opp : 'ZAR')}${esc(next.home ? team(next.opp).name : 'Real Zaragoza')}</div>
      </div>
      <div class="row" style="justify-content:center;margin-top:12px">${oppInfo(next.opp)}</div>
      <div style="text-align:center;margin-top:12px"><button class="btn" data-cal="${next.j}">📅 Añadir al calendario</button></div>` : '<p class="muted">Temporada terminada</p>'}
    </div>
    <div class="card link" id="cardMicro" title="Ver todos los microobjetivos">
      <h3>Microobjetivo actual <span class="go">›</span></h3>
      ${blk ? blockCard(blk) : ''}
    </div>
  </div>

  <div class="grid g4" style="margin-top:14px">
    <div class="card kpi"><span class="k">vs media campeones</span><span class="v ${me.pts - avgChampAtN >= 0 ? 'up' : 'down'}">${me.pts - avgChampAtN >= 0 ? '+' : ''}${fmt(me.pts - avgChampAtN, 1)}</span><span class="d">Media en J${n}: ${fmt(avgChampAtN, 1)} pts</span></div>
    <div class="card kpi"><span class="k">Colchón play-off</span><span class="v ${gap6 >= 0 ? 'up' : 'down'}">${gap6 >= 0 ? '+' : ''}${gap6}</span><span class="d">sobre el 6º (${esc(team(sixth.code).short)})</span></div>
    <div class="card kpi"><span class="k">Casa / Fuera</span><span class="v">${sum(home, m => m.pts)}·${sum(away, m => m.pts)}</span><span class="d">${home.length} y ${away.length} partidos</span></div>
    <div class="card kpi"><span class="k">Porterías a cero</span><span class="v">${cs}</span><span class="d">${fmt(me.ga / Math.max(1, n), 2)} goles encajados/partido</span></div>
  </div>

  ${top ? `<div class="grid g2" style="margin-top:14px">
    <div class="card spot link" data-rank="g">${avatar(top, 56)}<div><span class="k">Máximo goleador <span class="go">›</span></span><b>${esc(top.name)}</b><span class="d">${top.g} goles · ${top.a} asistencias</span></div></div>
    <div class="card spot link" data-rank="min">${avatar(topMin, 56)}<div><span class="k">Más minutos <span class="go">›</span></span><b>${esc(topMin.name)}</b><span class="d">${topMin.min}' · ${topMin.pt} titularidades</span></div></div>
  </div>` : ''}

  <div class="card" style="margin-top:14px">
    <h3>Ritmo de puntos</h3>
    <div class="sub">Zaragoza frente a la media de los 8 últimos campeones y al plan de microobjetivos de Ibai</div>
    <div class="chart-wrap short"><canvas id="cHomeRace"></canvas></div>
    <div class="legend"><span><i style="background:${c.zar}"></i>Zaragoza</span><span><i style="background:#f2c14e"></i>Media campeones</span><span><i style="background:#5b8cff"></i>Microobjetivos</span></div>
  </div>
  ${footer()}`;

  $$('#view-inicio .spot').forEach(el => el.onclick = () => rankingDialog(el.dataset.rank));
  $('#cardMicro').onclick = () => go('micro');
  $$('#view-inicio [data-cal]').forEach(b => b.onclick = () => calDialog(+b.dataset.cal));
  const cum = zarCumulative(), N = Math.max(cum.length + 4, 14);
  const avg = Array.from({ length: N }, (_, i) => +(champs.reduce((s, x) => s + x.curve[i], 0) / champs.length).toFixed(2));
  chart('cHomeRace', {
    type: 'line',
    data: { labels: jLabels(N), datasets: [
      { data: cum, borderColor: c.zar, borderWidth: 3, pointRadius: 3, pointBackgroundColor: c.zar, tension: .25 },
      { data: avg, borderColor: '#f2c14e', borderWidth: 2, pointRadius: 0, borderDash: [6, 4], tension: .25 },
      { data: Array.from({ length: N }, (_, i) => microTarget(i + 1, B)), borderColor: '#5b8cff', borderWidth: 2, pointRadius: 0, borderDash: [2, 4] }] },
    options: { scales: { y: gridY({ beginAtZero: true }), x: noGrid() }, interaction: { mode: 'index', intersect: false } }
  });
}
function badge(code) {
  const t = team(code);
  return `<div class="badge">${t.shield ? `<img src="${esc(t.shield)}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(code)}'))">` : esc(code)}</div>`;
}
function oppInfo(code) {
  const o = standings().find(s => s.code === code); if (!o) return '';
  return `<span class="pill">${esc(team(code).short)}: ${o.pos}º · ${o.pts} pts</span><span class="pill">Forma ${o.form.slice(-5).map(r => ({ W: 'V', D: 'E', L: 'D' }[r])).join('')}</span>`;
}
function avatar(p, size = 64) {
  const ph = photoOf(p);
  return `<div class="avatar pos-${p.pos}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .4)}px">${esc(initials(p.name))}${ph ? `<img src="${esc(ph)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</div>`;
}
function footer() {
  return `<p class="footer-src">${esc(S.season.source)}<br>Resultados: ${S.user.wikiAt ? new Date(S.user.wikiAt).toLocaleString('es-ES') : 'datos base ' + dateES(S.season.updated)} · Datos oficiales: ${S.official.updated ? new Date(S.official.updated).toLocaleString('es-ES') : '—'}<br>App personal sin relación oficial con el Real Zaragoza.</p>`;
}

/* ---------- TEMPORADA ---------- */
function currentRound() { const js = fixtures().filter(f => f.hg != null).map(f => f.j); return js.length ? Math.max(...js) : 1; }
function rTemporada() {
  const st = standings(), ms = zarMatches();
  const P = S.season.promotion;
  const zone = p => p <= P.direct ? 'z1' : (p >= P.playoff[0] && p <= P.playoff[1]) ? 'z2' : p >= P.relegation[0] ? 'z3' : 'z0';
  const nManual = Object.keys(S.user.manual || {}).length;
  const J = S.jornada || currentRound(); S.jornada = J;
  const fx = fixtures().filter(f => f.j === J);
  const dates = {}; S.season.fixtures.forEach(f => { dates[f.j] = dates[f.j] || f.date; });
  const nPlayed = fx.filter(f => f.hg != null).length;
  $('#view-temporada').innerHTML = `
  <div class="section-title"><h2>Clasificación</h2><small>Tras la jornada ${currentRound()}${nManual ? ` · incluye ${nManual} resultado${nManual > 1 ? 's' : ''} metido${nManual > 1 ? 's' : ''} a mano` : ''}</small></div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>Pts</th><th>PJ</th><th>V</th><th>E</th><th>D</th><th>GF</th><th>GC</th><th>DG</th><th>Forma</th></tr></thead>
    <tbody>${st.map(s => `<tr class="${s.code === S.season.team ? 'me' : ''}"><td><span class="zone ${zone(s.pos)}"></span>${s.pos}</td><td class="t">${crest(s.code, 'sm')}${esc(team(s.code).short)}</td><td class="pts"><b>${s.pts}</b></td><td>${s.pj}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.gf}</td><td>${s.ga}</td><td>${s.gf - s.ga > 0 ? '+' : ''}${s.gf - s.ga}</td><td><div class="form" style="gap:3px">${s.form.slice(-5).map(r => `<b class="${r}" style="width:16px;height:16px;font-size:9px;border-radius:4px">${{ W: 'V', D: 'E', L: 'D' }[r]}</b>`).join('')}</div></td></tr>`).join('')}</tbody>
  </table></div>
  <div class="legend"><span><i style="background:var(--win)"></i>Ascenso directo</span><span><i style="background:var(--blue2)"></i>Play-off</span><span><i style="background:var(--loss)"></i>Descenso</span><span class="muted">Desempate por diferencia de goles</span></div></div>

  <div class="section-title"><h2>Jornada</h2>
    <div class="jsel"><button class="btn" id="jPrev" ${J <= 1 ? 'disabled' : ''} aria-label="Jornada anterior">‹</button>
      <select id="jSel">${Array.from({ length: 38 }, (_, i) => i + 1).map(j => `<option value="${j}" ${j === J ? 'selected' : ''}>J${j} · ${dateES(dates[j]).slice(0, 5)}${j === currentRound() ? ' · actual' : ''}</option>`).join('')}</select>
      <button class="btn" id="jNext" ${J >= 38 ? 'disabled' : ''} aria-label="Jornada siguiente">›</button></div></div>
  <div class="card">
    <div class="sub">${nPlayed}/${fx.length} partidos con resultado · fecha de la jornada: ${dateES(dates[J])}</div>
    ${horariosNote(J, fx)}
    <div class="fixtures">${fx.map(f => fixtureRow(f)).join('')}</div>
    <p class="muted small" style="margin-top:10px">Los resultados llegan solos (Wikipedia y, el del Zaragoza, la web oficial). Si aún no aparece alguno, toca ✏️ para meterlo a mano: cuando se publique, se queda el oficial.</p>
  </div>

  <div class="section-title"><h2>Partidos del Zaragoza</h2><button class="btn cal-sub" id="calSub">📅 Calendario del Zaragoza</button></div>
  <div class="legend" style="margin:-4px 2px 10px"><span>🏠 En casa</span><span>✈️ Fuera</span><span>📅 Añadir al calendario</span><span class="muted">El marcador va siempre con el equipo local delante · toca un partido jugado para ver la ficha</span></div>
  <div class="matches">${ms.map(m => { const t = team(m.opp); return `<div class="match ${m.home ? 'home' : 'away'} ${m.res || official(m.j) ? 'clickable' : ''}" data-j="${m.j}"><div class="j">J${m.j}</div>${crest(m.opp)}<div class="opp"><b>${esc(t.name)}</b><div class="where">${venueIcon(m.home)}<span>${m.home ? 'Ibercaja Estadio' : esc(t.city) + ' · ' + esc(t.stadium)} · ${m.kickoff ? dateTimeES(m.kickoff) : dateES((zarCal(m.j) || {}).date || m.date) + (m.res ? '' : ' · hora por confirmar')}${official(m.j) ? ' · ✓' : S.user.actas[m.j] ? ' · 📝' : ''}</span></div></div>${m.res ? `<div class="score ${m.res}">${m.home ? m.gf + '-' + m.ga : m.ga + '-' + m.gf}</div>` : `<button class="cal-btn ${m.kickoff ? 'set' : ''}" data-cal="${m.j}" title="Añadir al calendario" aria-label="Añadir la jornada ${m.j} al calendario">📅</button>`}</div>`; }).join('')}</div>
  ${footer()}`;
  $$('#view-temporada .match.clickable').forEach(el => el.onclick = () => matchDialog(+el.dataset.j));
  $$('#view-temporada [data-cal]').forEach(b => b.onclick = e => { e.stopPropagation(); calDialog(+b.dataset.cal); });
  $('#calSub').onclick = () => calDialog(null);
  $('#jSel').onchange = e => { S.jornada = +e.target.value; rTemporada(); $('#jSel').scrollIntoView({ block: 'center' }); };
  $('#jPrev').onclick = () => { S.jornada = Math.max(1, J - 1); rTemporada(); $('#jSel').scrollIntoView({ block: 'center' }); };
  $('#jNext').onclick = () => { S.jornada = Math.min(38, J + 1); rTemporada(); $('#jSel').scrollIntoView({ block: 'center' }); };
  $$('#view-temporada .fx[data-zar]').forEach(el => el.onclick = e => { if (!e.target.closest('button,input')) matchDialog(+el.dataset.j); });
  $$('#view-temporada [data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); editResult(b.dataset.edit); });
}
function horariosNote(J, fx) {
  if (fx.every(f => f.hg != null)) return '';
  const last = Math.max(...fx.map(f => new Date((kickoffOf(f) || f.date + 'T23:00:00Z')).getTime()));
  const sch = ((S.schedule || {}).rfef || {})[J];
  if (sch && sch.rows && sch.rows.length) return `<div class="hnote ok">🕒 Horarios oficiales de la RFEF${sch.rows.length < fx.length ? ` (${sch.rows.length} de ${fx.length})` : ''} · <a href="${esc(sch.news)}" target="_blank" rel="noopener">ver cartel</a> · hora de España</div>`;
  if (last < Date.now() - 2 * 864e5) return '';
  const anyKo = fx.some(f => kickoffOf(f));
  return `<div class="hnote">🕒 ${anyKo ? 'Solo está la hora del Zaragoza. ' : ''}La RFEF publica los horarios con 2-3 semanas de antelación: aparecerán aquí solos.</div>`;
}
const fxName = code => code === 'ZAR' ? 'Zaragoza' : team(code).short;
function fixtureRow(f) {
  const k = `${f.h}_${f.a}`, me = S.season.team, zar = f.h === me || f.a === me;
  const manual = (S.user.manual || {})[k];
  const ko = kickoffOf(f), when = ko ? kickShort(ko) : '';
  const canEdit = !(zar && officialFinal(f.j));
  const res = f.hg != null ? (f.hg > f.ag ? 'h' : f.hg < f.ag ? 'a' : 'd') : '';
  return `<div class="fx ${zar ? 'zar' : ''}" ${zar ? `data-zar="1" data-j="${f.j}"` : ''}>
    <div class="fx-t h ${res === 'h' ? 'win' : ''}"><span>${esc(fxName(f.h))}</span>${crest(f.h)}</div>
    <div class="fx-s">${f.hg != null ? `<b>${f.hg}<i>-</i>${f.ag}</b>${manual ? '<small title="Metido a mano">✏️ a mano</small>' : ''}` : (when ? `<span class="fx-when">${when}</span>` : '<span class="muted small">—</span>')}
      ${canEdit ? `<button class="fx-edit" data-edit="${k}" title="${f.hg != null ? 'Corregir resultado' : 'Meter resultado'}">✏️</button>` : ''}</div>
    <div class="fx-t a ${res === 'a' ? 'win' : ''}">${crest(f.a)}<span>${esc(fxName(f.a))}</span></div>
  </div>`;
}
/* ---------- calendario ---------- */
const calURL = path => new URL(path, location.href).href;
const icsStamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function calDialog(j) {
  const subHttps = calURL('cal/zaragoza.ics'), subWebcal = subHttps.replace(/^https?:/, 'webcal:');
  const gSub = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(subWebcal);
  const subBlock = `<div class="cal-sub-box">
      <h3>🔄 Suscribirme a los partidos del Zaragoza</h3>
      <p class="muted small">Solo los partidos del Real Zaragoza: los 38 de liga y los de Copa. No incluye los del resto del grupo. Cuando la RFEF fija un horario, tu calendario lo cambia solo, sin hacer nada.</p>
      <div class="cal-actions">
        <a class="btn primary" href="${esc(subWebcal)}">iPhone · Mac · Outlook</a>
        <a class="btn" href="${esc(gSub)}" target="_blank" rel="noopener">Google Calendar</a>
      </div>
      <p class="muted small">Si el enlace no abre tu calendario, copia esta dirección y añádela como «calendario suscrito»:</p>
      <div class="cal-url"><input readonly value="${esc(subHttps)}" id="calUrl"><button class="btn" id="calCopy">Copiar</button></div>
    </div>`;
  let head = '', single = '';
  if (j != null) {
    const m = zarMatches().find(x => x.j === j); const t = team(m.opp), c = zarCal(j) || {};
    const hn = m.home ? 'Real Zaragoza' : t.name, an = m.home ? t.name : 'Real Zaragoza';
    const loc = [c.venue || (m.home ? 'Ibercaja Estadio' : t.stadium), m.home ? 'Zaragoza' : t.city].filter(Boolean).join(', ');
    const title = `⚽ ${hn} - ${an}`, details = `1ª Federación · Grupo 2 · Jornada ${j}\n${calURL('./')}`;
    let dates;
    if (m.kickoff) { const st = new Date(m.kickoff); dates = icsStamp(st) + '/' + icsStamp(new Date(st.getTime() + 2 * 3600e3)); }
    else { const d = new Date((c.date || m.date) + 'T12:00:00Z'), e = new Date(d.getTime() + 864e5); dates = d.toISOString().slice(0, 10).replace(/-/g, '') + '/' + e.toISOString().slice(0, 10).replace(/-/g, ''); }
    const gUrl = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: m.kickoff ? title : title + ' (horario por confirmar)', dates, location: loc, details, ctz: 'Europe/Madrid' });
    head = `<div class="muted small">Jornada ${j}</div><h2 style="font-size:24px">${esc(hn)} – ${esc(an)}</h2>
      <p class="cal-when">${m.kickoff ? `🕒 <b>${esc(dateTimeES(m.kickoff))}</b> (hora de España)` : `🕒 <b>${esc(dateES(c.date || m.date))}</b> · horario por confirmar`}<br>📍 ${esc(loc)}</p>`;
    single = `<div class="cal-actions">
        <a class="btn primary" href="${esc(gUrl)}" target="_blank" rel="noopener">Google Calendar</a>
        <a class="btn" href="${esc(calURL(`cal/j${String(j).padStart(2, '0')}.ics`))}" target="_blank" rel="noopener">iPhone · Outlook (.ics)</a>
      </div>
      ${m.kickoff ? '' : '<p class="muted small">Aún no hay hora: se añadirá como evento de todo el día. Si te suscribes al calendario de abajo, la hora aparecerá sola en cuanto se publique.</p>'}`;
  } else head = '<h2 style="font-size:24px">Calendario del Zaragoza</h2>';
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body"><div class="dlg-head"><div>${head}</div><button class="x" onclick="this.closest('dialog').close()">✕</button></div>${single}${subBlock}</div>`;
  dlg.showModal();
  $('#calCopy').onclick = async () => { try { await navigator.clipboard.writeText(subHttps); toast('Dirección copiada'); } catch { $('#calUrl').select(); } };
}
function editResult(k) {
  const [h, a] = k.split('_'), f = fixtures().find(x => `${x.h}_${x.a}` === k);
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body">
    <div class="dlg-head"><h2 style="font-size:24px">Resultado · Jornada ${f.j}</h2><button class="x" onclick="this.closest('dialog').close()">✕</button></div>
    <div class="edit-res">
      <div>${crest(h, 'lg')}<span>${esc(team(h).short)}</span><input id="eh" type="number" min="0" inputmode="numeric" value="${f.hg ?? ''}"></div>
      <b>-</b>
      <div>${crest(a, 'lg')}<span>${esc(team(a).short)}</span><input id="ea" type="number" min="0" inputmode="numeric" value="${f.ag ?? ''}"></div>
    </div>
    <p class="muted small">Se guarda como resultado «a mano». Cuando Wikipedia publique el oficial, se sustituirá.</p>
    <div class="row" style="justify-content:space-between;margin-top:12px">${(S.user.manual || {})[k] ? '<button class="btn danger" id="eDel">Quitar resultado</button>' : '<span></span>'}<button class="btn primary" id="eSave">Guardar</button></div>
  </div>`;
  dlg.showModal(); setTimeout(() => $('#eh').focus(), 50);
  $('#eSave').onclick = () => {
    const x = $('#eh').value, y = $('#ea').value; if (x === '' || y === '') { toast('Pon los dos marcadores'); return; }
    S.user.results[k] = [+x, +y]; S.user.manual = { ...(S.user.manual || {}), [k]: true };
    saveUser(); dlg.close(); renderAll(); toast(`${team(h).short} ${x}-${y} ${team(a).short} guardado ✓`);
  };
  if ($('#eDel')) $('#eDel').onclick = () => { delete S.user.results[k]; delete S.user.manual[k]; saveUser(); dlg.close(); renderAll(); toast('Resultado quitado'); };
}

/* ---------- ESTADÍSTICAS ---------- */
function rEstadisticas() {
  const c = C();
  const st = standings(), ms = zarMatches(), n = lastRound();
  const TS = teamStats();
  const avgS = (k, side = 'z') => TS.length ? sum(TS, r => r[side][k]) / TS.filter(r => r[side][k] != null).length : null;
  const passPct = side => { const a = sum(TS, r => r[side].accuratePass), t = sum(TS, r => r[side].totalPass); return t ? a / t * 100 : null; };
  $('#view-estadisticas').innerHTML = `
  <div class="section-title"><h2>Estadísticas</h2><small>Evolución del Zaragoza y números del equipo</small></div>
  <div class="grid g2">
    <div class="card"><h3>Evolución en la tabla</h3><div class="sub">Puesto tras cada jornada</div><div class="chart-wrap"><canvas id="cPos"></canvas></div></div>
    <div class="card"><h3>Carrera por el ascenso</h3><div class="sub">Puntos acumulados de los 5 primeros</div><div class="chart-wrap"><canvas id="cRace"></canvas></div><div class="legend" id="lgRace"></div></div>
    <div class="card"><h3>Goles por jornada</h3><div class="sub">A favor (arriba) y en contra (abajo)</div><div class="chart-wrap short"><canvas id="cGoals"></canvas></div></div>
    <div class="card"><h3>Casa vs fuera</h3><div class="sub">Puntos por partido y goles por partido</div><div class="chart-wrap short"><canvas id="cHA"></canvas></div></div>
  </div>

  ${TS.length ? `<div class="section-title"><h2>Estadísticas del equipo</h2><small>Media por partido · ${TS.length} partidos con datos oficiales</small></div>
  <div class="grid g4">
    ${[['Posesión', avgS('possessionPercentage'), avgS('possessionPercentage', 'o'), '%', 0], ['Tiros', avgS('totalScoringAtt'), avgS('totalScoringAtt', 'o'), '', 1], ['Tiros a puerta', avgS('ontargetScoringAtt'), avgS('ontargetScoringAtt', 'o'), '', 1], ['Precisión de pase', passPct('z'), passPct('o'), '%', 0], ['Pases', avgS('totalPass'), avgS('totalPass', 'o'), '', 0], ['Córners', avgS('cornerTaken'), avgS('cornerTaken', 'o'), '', 1], ['Faltas cometidas', avgS('fouls'), avgS('fouls', 'o'), '', 1], ['Entradas', avgS('totalTackle'), avgS('totalTackle', 'o'), '', 1]]
      .map(([k, z, o, u, d]) => `<div class="card kpi"><span class="k">${k}</span><span class="v">${fmt(z, d)}${u}</span><span class="d">Rivales: ${fmt(o, d)}${u}</span>${statBar(z, o)}</div>`).join('')}
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Tiros por partido</h3><div class="sub">Totales y a puerta, Zaragoza vs rival</div><div class="chart-wrap"><canvas id="cShots"></canvas></div></div>
    <div class="card"><h3>Posesión y precisión de pase</h3><div class="sub">Por jornada</div><div class="chart-wrap"><canvas id="cPoss"></canvas></div></div>
  </div>` : ''}

  ${footer()}`;

  const pos = positionsByRound();
  chart('cPos', { type: 'line', data: { labels: jLabels(pos.length), datasets: [{ data: pos, borderColor: c.zar, backgroundColor: c.zarFill, fill: 'start', borderWidth: 3, pointRadius: 4, pointBackgroundColor: pos.map(p => p === 1 ? '#22c58b' : p <= 5 ? '#5b8cff' : '#ff5a6a'), tension: .3 }] },
    options: { scales: { y: gridY({ reverse: true, min: 1, max: 20, ticks: { stepSize: 1, callback: v => [1, 5, 10, 15, 20].includes(v) ? v + 'º' : '' } }), x: noGrid() } } });

  const top = st.slice(0, 5).map(s => s.code); if (!top.includes(S.season.team)) top.push(S.season.team);
  const pal = ['#ff5a5f', '#f5b83d', '#3ccf7a', '#a77bff', '#36b9e6'];
  const tables = Array.from({ length: n }, (_, i) => standings(i + 1));
  const ds = top.map((code, i) => { const meT = code === S.season.team; return { label: team(code).short, data: tables.map(t => t.find(x => x.code === code).pts), borderColor: meT ? c.zar : pal[i % pal.length], borderWidth: meT ? 3.5 : 2, pointRadius: meT ? 3 : 0, tension: .25 }; });
  chart('cRace', { type: 'line', data: { labels: jLabels(n), datasets: ds }, options: { interaction: { mode: 'index', intersect: false }, scales: { y: gridY({ beginAtZero: true }), x: noGrid() } } });
  $('#lgRace').innerHTML = ds.map(d => `<span><i style="background:${d.borderColor}"></i>${esc(d.label)}</span>`).join('');

  const pl = ms.filter(m => m.res);
  chart('cGoals', { type: 'bar', data: { labels: pl.map(m => 'J' + m.j), datasets: [{ data: pl.map(m => m.gf), backgroundColor: '#22c58b', borderRadius: 4 }, { data: pl.map(m => -m.ga), backgroundColor: '#ff5a6a', borderRadius: 4 }] },
    options: { scales: { x: noGrid({ stacked: true }), y: gridY({ stacked: true, ticks: { callback: v => Math.abs(v) } }) }, plugins: { tooltip: { callbacks: { label: x => (x.datasetIndex ? 'En contra: ' : 'A favor: ') + Math.abs(x.raw) } } } } });

  const h = pl.filter(m => m.home), a = pl.filter(m => !m.home), avg = (arr, f) => arr.length ? sum(arr, f) / arr.length : 0;
  chart('cHA', { type: 'bar', data: { labels: ['Pts/partido', 'Goles a favor', 'Goles en contra'], datasets: [
    { label: 'Casa', data: [avg(h, m => m.pts), avg(h, m => m.gf), avg(h, m => m.ga)].map(v => +v.toFixed(2)), backgroundColor: c.zar, borderRadius: 6 },
    { label: 'Fuera', data: [avg(a, m => m.pts), avg(a, m => m.gf), avg(a, m => m.ga)].map(v => +v.toFixed(2)), backgroundColor: '#5b8cff', borderRadius: 6 }] },
    options: { plugins: { legend: { display: true, labels: { boxWidth: 12 } } }, scales: { y: gridY({ beginAtZero: true }), x: noGrid() } } });

  if (TS.length) {
    chart('cShots', { type: 'bar', data: { labels: TS.map(r => 'J' + r.j), datasets: [
      { label: 'Tiros RZ', data: TS.map(r => r.z.totalScoringAtt), backgroundColor: c.zar + '55', borderColor: c.zar, borderWidth: 1, borderRadius: 4, stack: 'z' },
      { label: 'A puerta RZ', data: TS.map(r => r.z.ontargetScoringAtt), backgroundColor: c.zar, borderRadius: 4, stack: 'z2' },
      { label: 'Tiros rival', data: TS.map(r => r.o.totalScoringAtt), backgroundColor: '#ff5a6a55', borderColor: '#ff5a6a', borderWidth: 1, borderRadius: 4, stack: 'o' },
      { label: 'A puerta rival', data: TS.map(r => r.o.ontargetScoringAtt), backgroundColor: '#ff5a6a', borderRadius: 4, stack: 'o2' }] },
      options: { plugins: { legend: { display: true, labels: { boxWidth: 10 } }, tooltip: { mode: 'index', intersect: false } }, scales: { y: gridY({ beginAtZero: true }), x: noGrid() } } });
    chart('cPoss', { type: 'line', data: { labels: TS.map(r => 'J' + r.j), datasets: [
      { label: 'Posesión %', data: TS.map(r => r.z.possessionPercentage), borderColor: c.zar, backgroundColor: c.zarFill, fill: 'origin', borderWidth: 3, pointRadius: 4, tension: .3 },
      { label: 'Precisión de pase %', data: TS.map(r => r.z.totalPass ? +(r.z.accuratePass / r.z.totalPass * 100).toFixed(1) : null), borderColor: '#f2c14e', borderWidth: 2, pointRadius: 3, tension: .3, borderDash: [5, 4] }] },
      options: { plugins: { legend: { display: true, labels: { boxWidth: 10 } } }, interaction: { mode: 'index', intersect: false }, scales: { y: gridY({ min: 0, max: 100, ticks: { callback: v => v + '%' } }), x: noGrid() } } });
  }
}
function statBar(z, o) { if (z == null || o == null || z + o === 0) return ''; const p = z / (z + o) * 100; return `<div class="duel"><i style="width:${p}%"></i></div>`; }

/* ---------- ficha de partido ---------- */
function matchDialog(j) {
  const m = zarMatches().find(x => x.j === j), d = matchDetail(j), om = official(j);
  const name = k => esc(player(k).short || player(k).name);
  const homeName = m.home ? 'Real Zaragoza' : team(m.opp).name, awayName = m.home ? team(m.opp).name : 'Real Zaragoza';
  const evs = [];
  if (d) {
    d.goals.forEach(g => evs.push({ min: g.min, side: 'ZAR', ic: '⚽', txt: g.og ? `Gol en propia de ${esc(g.ogBy || 'rival')}` : `${name(g.player)}${g.pen ? ' (pen.)' : ''}${g.assist ? ` <small>asist. ${name(g.assist)}</small>` : ''}` }));
    d.cards.forEach(cd => evs.push({ min: cd.min, side: 'ZAR', ic: cd.type === 'Y' ? '🟨' : cd.type === 'YR' ? '🟨🟥' : '🟥', txt: name(cd.player) }));
    d.subs.forEach(s => evs.push({ min: s.min, side: 'ZAR', ic: '🔄', txt: `${s.in ? name(s.in) : '?'} <small>por ${s.out ? name(s.out) : '?'}</small>` }));
    (d.oppGoals || []).forEach(g => evs.push({ min: g.min, side: 'OPP', ic: '⚽', txt: g.og ? `Gol en propia de ${esc(g.player)}` : `${esc(g.player)}${g.pen ? ' (pen.)' : ''}` }));
    (d.oppCards || []).forEach(cd => evs.push({ min: cd.min, side: 'OPP', ic: cd.card === 'Y' ? '🟨' : '🟥', txt: esc(cd.player) }));
  }
  evs.sort((a, b) => a.min - b.min);
  const S2 = d && d.stats && d.stats.zar ? d.stats : null;
  const rows = S2 ? [['Posesión', 'possessionPercentage', '%'], ['Tiros', 'totalScoringAtt'], ['A puerta', 'ontargetScoringAtt'], ['Fuera', 'shotOffTarget'], ['Pases', 'totalPass'], ['Pases buenos', 'accuratePass'], ['Córners', 'cornerTaken'], ['Faltas', 'fouls'], ['Entradas', 'totalTackle'], ['Intercepciones', 'interception'], ['Fueras de juego', 'totalOffside'], ['Saques de banda', 'totalThrows']].filter(([, k]) => S2.zar[k] != null) : [];
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body">
    <div class="dlg-head"><div><div class="muted small">Jornada ${j} · ${m.kickoff ? dateTimeES(m.kickoff) : dateES(m.date)} · ${m.home ? '🏠 Ibercaja Estadio' : '✈️ ' + esc(team(m.opp).city) + ' (' + esc((om && om.venue) || team(m.opp).stadium) + ')'}</div><h2 style="font-size:24px">${esc(homeName)} – ${esc(awayName)}</h2><div class="dlg-teams">${crest(m.home ? 'ZAR' : m.opp)}<span class="sc">${m.res ? `${m.home ? m.gf : m.ga} - ${m.home ? m.ga : m.gf}` : 'vs'}</span>${crest(m.home ? m.opp : 'ZAR')}</div></div><button class="x" onclick="this.closest('dialog').close()">✕</button></div>
    ${om ? `<div class="row small muted" style="margin-bottom:10px">${om.referee ? '🧑‍⚖️ ' + esc(om.referee) : ''}${om.att ? ' · 👥 ' + om.att.toLocaleString('es-ES') : ''}${om.form ? ` · Sistema RZ: ${esc((m.home ? om.form.home : om.form.away) || '').split('').join('-')}` : ''}</div>` : ''}
    ${!d ? '<p class="muted">Sin datos de este partido todavía.</p>' : `
    <h3 style="font-size:20px">Minuto a minuto</h3>
    <div class="timeline">${evs.map(e => `<div class="tl ${e.side === 'ZAR' ? 'z' : 'o'}"><span class="tm">${e.min}'</span><span class="ic">${e.ic}</span><span class="tx">${e.txt}</span></div>`).join('') || '<p class="muted small">Sin eventos</p>'}</div>
    <h3 style="font-size:20px;margin-top:14px">Once del Zaragoza</h3>
    <div class="chips">${d.starters.map(k => `<span class="chip-toggle on">${player(k).n ?? ''} ${name(k)}${k === d.captain ? ' (C)' : ''}</span>`).join('')}</div>
    ${d.bench && d.bench.length ? `<div class="muted small" style="margin:8px 0 4px">Suplentes</div><div class="chips">${d.bench.map(k => `<span class="chip-toggle">${player(k).n ?? ''} ${name(k)}</span>`).join('')}</div>` : ''}
    ${rows.length ? `<h3 style="font-size:20px;margin-top:14px">Estadísticas</h3><div class="cmp-stats">${rows.map(([lbl, k, u = '']) => { const z = S2.zar[k], o = (S2.opp || {})[k]; const tot = (z || 0) + (o || 0); return `<div class="cs"><b>${z ?? '–'}${u}</b><span>${lbl}</span><b>${o ?? '–'}${u}</b><div class="duel"><i style="width:${tot ? z / tot * 100 : 50}%"></i></div></div>`; }).join('')}</div>` : ''}
    ${d.source === 'official' ? `<p class="muted small" style="margin-top:12px">Fuente: realzaragoza.com. Las asistencias no las publica la web oficial: puedes añadirlas en la pestaña Acta.</p>` : `<p class="muted small" style="margin-top:12px">Fuente: tu acta.</p>`}`}
  </div>`;
  dlg.showModal();
}

/* ---------- CAMPEONES ---------- */
function champSet() { const all = S.history.seasons; return S.champMode === 'last4' ? all.filter(s => s.season === '25/26' || s.season === '24/25') : all; }
function rCampeones() {
  const c = C();
  const cum = zarCumulative(), n = cum.length, pts = cum[n - 1] || 0, ppg = n ? pts / n : 0;
  const cs = champSet();
  $('#view-campeones').innerHTML = `
  <div class="section-title"><h2>Real Zaragoza vs últimos campeones</h2>
    <div class="seg"><button data-m="last4" class="${S.champMode === 'last4' ? 'on' : ''}">Últimos 4</button><button data-m="all" class="${S.champMode === 'all' ? 'on' : ''}">Últimos 8</button></div></div>
  <div class="champs">
    <div class="ccard zar"><div class="rank">1</div>
      <div class="head"><div class="chip" style="background:#fff;padding:4px"><img src="${esc(S.squad.shield)}" alt="" style="width:100%;height:100%;object-fit:contain" onerror="this.replaceWith(document.createTextNode('RZ'))"></div><div><div class="name">Real Zaragoza</div><div class="meta">26/27 · Grupo 2</div></div></div>
      <div class="cols"><div><div class="colh">DATOS</div><div class="big"><small>J${n}:</small>${pts}</div><div class="unit">PUNTOS</div></div><div class="sep"></div>
      <div><div class="colh">FINAL LIGA</div><div class="proj">PROYECCIÓN</div><div class="big" style="color:#1747c9">${fmt(ppg * 38, 1)}</div><div class="unit">PUNTOS</div></div></div>
      <div class="foot">MEDIA PARTIDO (J${n}): <b style="color:#1747c9">${fmt(ppg, 2)}</b> PUNTOS</div></div>
    ${cs.map((x, i) => { const col = CHAMP_COLORS[x.champion] || '#999', atN = x.curve[Math.max(0, n - 1)], diff = pts - atN; return `
    <div class="ccard"><div class="rank">${i + 2}</div>
      <div class="head"><div class="chip shield" style="border-color:${col}">${champCrest(x.champion) || CHAMP_ABBR[x.champion]}</div><div><div class="name">${esc(x.champion)}</div><div class="meta">${x.season} · Grupo ${x.group} · ${x.record.w}V ${x.record.d}E ${x.record.l}D</div></div></div>
      <div class="cols"><div><div class="colh">DATOS</div><div class="big" style="color:${diff > 0 ? '#c0392b' : '#0a1430'}"><small>J${n}:</small>${atN}</div><div class="unit">PUNTOS · <span style="color:${diff >= 0 ? '#16a36f' : '#c0392b'}">RZ ${diff >= 0 ? '+' : ''}${diff}</span></div></div><div class="sep"></div>
      <div><div class="colh">FINAL LIGA</div><div class="big">${x.points}</div><div class="unit">PUNTOS</div></div></div>
      <div class="foot">MEDIA PARTIDO (LIGA): <b style="color:${col}">${fmt(x.points / 38, 2)}</b> PUNTOS</div></div>`; }).join('')}
  </div>

  <div class="card" style="margin-top:14px"><h3>Puntos acumulados por jornada</h3><div class="sub">Toca la leyenda para ocultar o mostrar equipos</div>
    <div class="chart-wrap tall"><canvas id="cChamps"></canvas></div><div class="legend" id="lgChamps"></div></div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Diferencia con cada campeón</h3><div class="sub">Puntos del Zaragoza menos los del campeón en la misma jornada (J${n})</div><div class="chart-wrap"><canvas id="cDiff"></canvas></div></div>
    <div class="card"><h3>Dónde estaría el Zaragoza</h3><div class="sub">Media de 22/23-24/25 (6 grupos) de los puntos del 1º, 2º, 5º y 15º en cada jornada</div><div class="chart-wrap"><canvas id="cBands"></canvas></div>
      <div class="legend"><span><i style="background:${c.zar}"></i>Zaragoza</span><span><i style="background:#22c58b"></i>1º</span><span><i style="background:#f2c14e"></i>2º</span><span><i style="background:#5b8cff"></i>5º (play-off)</span><span><i style="background:#ff5a6a"></i>15º (salvación)</span></div></div>
  </div>

  <div class="card" style="margin-top:14px"><h3>Ficha de los campeones</h3><div class="table-wrap"><table>
    <thead><tr><th style="text-align:left">Campeón</th><th>Temp.</th><th>Gr.</th><th>J${n}</th><th>J19</th><th>Final</th><th>Pts/P</th><th>GF</th><th>GC</th><th>2º</th></tr></thead>
    <tbody>${S.history.seasons.map(x => `<tr><td class="t"><span class="zone" style="background:${CHAMP_COLORS[x.champion]}"></span>${champCrest(x.champion, 'sm')}${esc(x.champion)}</td><td>${x.season}</td><td>${x.group}</td><td>${x.curve[Math.max(0, n - 1)]}</td><td>${x.curve[18]}</td><td><b>${x.points}</b></td><td>${fmt(x.points / 38, 2)}</td><td>${x.record.gf}</td><td>${x.record.ga}</td><td>${x.final.second}</td></tr>`).join('')}
    <tr class="me"><td class="t"><span class="zone"></span>${crest('ZAR', 'sm')}Real Zaragoza</td><td>26/27</td><td>2</td><td>${pts}</td><td>${cum[18] ?? '–'}</td><td>${fmt(ppg * 38, 1)}*</td><td>${fmt(ppg, 2)}</td><td colspan="3" class="muted">* proyección</td></tr></tbody></table></div>
    <p class="muted small" style="margin-top:8px">Tenerife 25/26: 76 puntos según la clasificación oficial (22V 10E 6D). Algunas infografías lo dan con 74.</p></div>
  ${footer()}`;

  $$('#view-campeones .seg button').forEach(b => b.onclick = () => { S.champMode = b.dataset.m; rCampeones(); });
  const ds = [{ label: 'Real Zaragoza', data: cum, borderColor: c.zar, borderWidth: 4, pointRadius: 3, pointBackgroundColor: c.zar, tension: .25, order: 0 }]
    .concat(cs.map(x => ({ label: `${CHAMP_ABBR[x.champion]} ${x.season.replace('/', '')}`, data: x.curve, borderColor: CHAMP_COLORS[x.champion], borderWidth: 2, pointRadius: 0, tension: .25 })));
  const ch = chart('cChamps', { type: 'line', data: { labels: jLabels(38), datasets: ds }, options: { interaction: { mode: 'index', intersect: false }, scales: { y: gridY({ beginAtZero: true, max: 85 }), x: noGrid({ ticks: { maxTicksLimit: 13 } }) } } });
  $('#lgChamps').innerHTML = ds.map((d, i) => `<span data-i="${i}"><i style="background:${d.borderColor}"></i>${esc(d.label)}</span>`).join('');
  $$('#lgChamps span').forEach(sp => sp.onclick = () => { const i = +sp.dataset.i, v = ch.isDatasetVisible(i); ch.setDatasetVisibility(i, !v); ch.update(); sp.classList.toggle('off', v); });

  const all = S.history.seasons;
  chart('cDiff', { type: 'bar', data: { labels: all.map(x => `${CHAMP_ABBR[x.champion]} ${x.season}`), datasets: [{ data: all.map(x => pts - x.curve[Math.max(0, n - 1)]), backgroundColor: all.map(x => (pts - x.curve[Math.max(0, n - 1)]) >= 0 ? '#22c58b' : '#ff5a6a'), borderRadius: 6 }] },
    options: { indexAxis: 'y', scales: { x: gridY(), y: noGrid() }, plugins: { tooltip: { callbacks: { label: x => (x.raw >= 0 ? '+' : '') + x.raw + ' pts' } } } } });
  const withB = all.filter(x => x.bands), band = k => Array.from({ length: 38 }, (_, i) => +(withB.reduce((s, x) => s + x.bands[k][i], 0) / withB.length).toFixed(1));
  chart('cBands', { type: 'line', data: { labels: jLabels(38), datasets: [
    { data: cum, borderColor: c.zar, borderWidth: 3.5, pointRadius: 2, tension: .25 },
    { data: band('p1'), borderColor: '#22c58b', borderWidth: 2, pointRadius: 0, tension: .25 },
    { data: band('p2'), borderColor: '#f2c14e', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 4] },
    { data: band('p5'), borderColor: '#5b8cff', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 4] },
    { data: band('p15'), borderColor: '#ff5a6a', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [2, 4] }] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { y: gridY({ beginAtZero: true }), x: noGrid({ ticks: { maxTicksLimit: 13 } }) } } });
}

/* ---------- MICROOBJETIVOS ---------- */
function microBlocks() {
  // Ibai: «Hay que separar los dos primeros partidos y, luego, hacer nueve bloques de cuatro jornadas»
  const M = S.season.micro, ms = zarMatches(), blocks = [];
  const plan = [{ size: M.first.size, target: M.first.target, label: M.first.label }].concat(Array.from({ length: M.blocks }, () => ({ size: M.size, target: M.target })));
  let j = 1;
  plan.forEach((pl, i) => {
    const { size, target } = pl;
    const games = ms.filter(m => m.j >= j && m.j < j + size);
    const played = games.filter(m => m.res), pts = sum(played, m => m.pts);
    const maxPossible = pts + (games.length - played.length) * 3;
    const status = played.length === games.length ? (pts >= target ? 'ok' : 'ko') : played.length ? 'live' : (maxPossible < target ? 'ko' : 'pending');
    blocks.push({ i, label: pl.label || `Bloque ${i}`, from: j, to: j + size - 1, size, target, games, played: played.length, pts, status, need: Math.max(0, target - pts) });
    j += size;
  });
  if (!blocks.some(b => b.status === 'live')) { const nx = blocks.find(b => b.status === 'pending'); if (nx) nx.status = 'live'; }
  return blocks;
}
function microTarget(j, B = microBlocks()) { let t = 0; B.forEach(b => { const k = Math.max(0, Math.min(j, b.to) - b.from + 1); if (k > 0) t += b.target * (k / b.size); }); return +t.toFixed(2); }
function blockCard(b) {
  const pct = Math.min(100, b.pts / (b.size * 3) * 100), tg = b.target / (b.size * 3) * 100;
  const label = b.status === 'ok' ? '✅ Cumplido' : b.status === 'ko' ? '❌ No cumplido' : b.status === 'live' ? (b.need ? `⏳ En juego · faltan ${b.need} pts` : `✅ Objetivo ya alcanzado · ${b.size - b.played} partido${b.size - b.played > 1 ? 's' : ''} por jugar`) : 'Pendiente';
  return `<div class="bh"><h3>${esc(b.label)} <small class="muted" style="font-family:Inter;font-size:12px">J${b.from}-J${b.to}</small></h3><div class="pts">${b.pts}<small>/${b.target}</small></div></div>
  <div class="bar"><i style="width:${pct}%"></i><span class="tgt" style="left:${tg}%"></span></div>
  <div class="row" style="justify-content:space-between;margin-top:8px"><span class="small">${label}</span><span class="small muted">${b.pts - b.target >= 0 && b.played === b.size ? '+' + (b.pts - b.target) + ' de superávit' : ''}</span></div>
  <div class="mini">${b.games.map(m => `<div class="${m.res || ''}" title="${esc(team(m.opp).name)} (${m.home ? 'casa' : 'fuera'})">${crest(m.opp)}<b>${m.res ? (m.home ? m.gf + '-' + m.ga : m.ga + '-' + m.gf) : '·'}</b><small>${m.home ? '🏠' : '✈️'}</small></div>`).join('')}</div>`;
}
function rMicro() {
  const c = C(), B = microBlocks(), done = B.filter(b => b.status === 'ok' || b.status === 'ko'), ok = B.filter(b => b.status === 'ok').length;
  const cum = zarCumulative(), n = cum.length, pts = cum[n - 1] || 0;
  const target = j => microTarget(j, B);
  const blockEnds = Array.from({ length: 38 }, (_, i) => B.some(x => x.to === i + 1));
  const sup = pts - target(n);
  $('#view-micro').innerHTML = `
  <div class="section-title"><h2>Microobjetivos de Ibai</h2><small>Preludio de 2 partidos + 9 bloques de 4</small></div>
  <div class="note">«Hay que separar los dos primeros partidos y, luego, hacer nueve bloques de cuatro jornadas», explicó Ibai Gómez. El <b>preludio</b> son las jornadas 1 y 2 (Tarragona y Antequera), con el objetivo de sumar <b>6 de 6</b>. Después, <b>7 puntos de cada 12</b> en cada uno de los nueve bloques. Si se cumple todo, son <b>69 puntos</b>: según Ibai, «prácticamente, campeones de liga».</div>
  <div class="grid g4" style="margin-top:14px">
    <div class="card kpi"><span class="k">Superávit acumulado</span><span class="v ${sup >= 0 ? 'up' : 'down'}">${sup >= 0 ? '+' : ''}${fmt(sup, 1)}</span><span class="d">${pts} pts frente a ${fmt(target(n), 1)} del plan (J${n})</span></div>
    <div class="card kpi"><span class="k">Bloques cumplidos</span><span class="v">${ok}/${done.length}</span><span class="d">de los cerrados</span></div>
    <div class="card kpi"><span class="k">Proyección al ritmo actual</span><span class="v">${fmt(pts / Math.max(1, n) * 38, 1)}</span><span class="d">vs 69 del plan</span></div>
    <div class="card kpi"><span class="k">Para llegar a 69</span><span class="v">${Math.max(0, 69 - pts)}</span><span class="d">pts en ${38 - n} partidos: ${fmt(Math.max(0, 69 - pts) / Math.max(1, 38 - n), 2)} por partido</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Plan vs realidad</h3><div class="sub">Puntos acumulados del Zaragoza frente al objetivo de cada bloque</div>
    <div class="chart-wrap"><canvas id="cMicro"></canvas></div>
    <div class="legend"><span><i style="background:${c.zar}"></i>Zaragoza</span><span><i style="background:#5b8cff"></i>Plan (6 + 7 cada 4)</span><span><i style="background:#22c58b"></i>Superávit por bloque</span></div></div>
  <div class="blocks" style="margin-top:14px">${B.map(b => `<div class="block ${b.status === 'ok' ? 'ok' : b.status === 'ko' ? 'ko' : b.status === 'live' ? 'live' : ''}">${blockCard(b)}</div>`).join('')}</div>
  ${footer()}`;
  chart('cMicro', { data: { labels: jLabels(38), datasets: [
    { type: 'line', data: cum, borderColor: c.zar, borderWidth: 3.5, pointRadius: 3, pointBackgroundColor: c.zar, tension: .2, order: 0 },
    { type: 'line', data: Array.from({ length: 38 }, (_, i) => target(i + 1)), borderColor: '#5b8cff', borderWidth: 2, borderDash: [6, 4], pointRadius: blockEnds.map(v => v ? 4 : 0), pointBackgroundColor: '#5b8cff', tension: 0, order: 1 },
    { type: 'bar', data: Array.from({ length: 38 }, (_, i) => { const b = B.find(x => x.to === i + 1 && x.played === x.size); return b ? b.pts - b.target : null; }), backgroundColor: x => (x.raw ?? 0) >= 0 ? '#22c58b' : '#ff5a6a', borderRadius: 4, order: 2 }] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { y: gridY({ beginAtZero: true }), x: noGrid({ ticks: { maxTicksLimit: 13 } }) } } });
}

/* ---------- PLANTILLA ---------- */
function rPlantilla() {
  const c = C(), P = playerTotals(), nPlayed = lastRound(), maxMin = nPlayed * 90;
  const keys = { min: 'Minutos', g: 'Goles', a: 'Asistencias', ga: 'G+A', pj: 'Partidos', pt: 'Titular', y: 'Amarillas' };
  const list = P.filter(p => S.posFilter === 'ALL' || p.pos === S.posFilter).sort((a, b) => (b[S.sortBy] - a[S.sortBy]) || b.min - a.min || (a.n ?? 99) - (b.n ?? 99));
  const totG = sum(P, p => p.g);
  $('#view-plantilla').innerHTML = `
  <div class="section-title"><h2>Plantilla</h2><small>${P.length} jugadores · ${maxMin}' disputados</small></div>
  <div class="toolbar">
    <div class="seg" id="segPos">${['ALL', 'POR', 'DEF', 'MED', 'DEL', 'FIL'].map(k => `<button data-k="${k}" class="${S.posFilter === k ? 'on' : ''}">${k === 'ALL' ? 'Todos' : k}</button>`).join('')}</div>
    <select id="selSort" style="width:auto">${Object.entries(keys).map(([k, v]) => `<option value="${k}" ${S.sortBy === k ? 'selected' : ''}>Ordenar: ${v}</option>`).join('')}</select>
    <button class="btn ${S.cmpMode ? 'primary' : 'ghost'}" id="btnCmp">${S.cmpMode ? `Elige 2 jugadores (${S.compare.length}/2)` : S.compare.length === 2 ? 'Quitar comparación' : '⚖️ Comparar'}</button>
  </div>
  <div class="players">${list.map(p => `
    <div class="pcard ${S.compare.includes(p.key) ? 'sel' : ''}" data-key="${esc(p.key)}">
      <div class="num">${p.n ?? ''}</div>
      ${avatar(p, 64)}
      <div class="pn">${esc(p.name)}</div><div class="pp">${POS_NAME[p.pos] || ''}${p.n ? ' · #' + p.n : ''}</div>
      <div class="pstats"><div><b>${p.min}'</b><span>Min</span></div><div><b>${p.g}</b><span>Goles</span></div><div><b>${p.a}</b><span>Asist</span></div></div>
      <div class="minbar" title="${Math.round(p.min / Math.max(1, maxMin) * 100)}% de los minutos"><i style="width:${Math.min(100, p.min / Math.max(1, maxMin) * 100)}%"></i></div>
      <div class="pfoot"><span>${p.pj} PJ · ${p.pt} tit.</span><span>${p.y ? `<i class="cardY"></i>${p.y}` : ''}${p.r ? ` <i class="cardR"></i>${p.r}` : ''}</span></div>
    </div>`).join('')}</div>

  <div id="cmpBox"></div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card span2"><h3>Reparto de minutos</h3><div class="sub">% de los ${maxMin} minutos posibles · color por demarcación</div><div class="chart-wrap tall"><canvas id="cMins"></canvas></div></div>
    <div class="card"><h3>Participación en goles</h3><div class="sub">Goles + asistencias (${totG} goles de jugadores)</div><div class="chart-wrap"><canvas id="cGA"></canvas></div></div>
    <div class="card"><h3>Eficiencia</h3><div class="sub">Minutos jugados vs goles+asistencias por 90'</div><div class="chart-wrap"><canvas id="cEff"></canvas></div></div>
    <div class="card span2"><h3>Quién jugó cada jornada</h3><div class="sub">Minutos por partido · más intenso = más minutos · ▲ titular</div><div class="heat" id="heat"></div></div>
  </div>
  <p class="footer-src">Minutos, partidos, goles y tarjetas: realzaragoza.com. Asistencias: AupaZaragoza.com hasta la J${S.squad.assistsBase.upto} y tus actas a partir de ahí (la web oficial no las publica).</p>`;

  $$('#segPos button').forEach(b => b.onclick = () => { S.posFilter = b.dataset.k; rPlantilla(); });
  $('#selSort').onchange = e => { S.sortBy = e.target.value; rPlantilla(); };
  $('#btnCmp').onclick = () => { if (S.cmpMode || S.compare.length === 2) { S.cmpMode = false; S.compare = []; } else { S.cmpMode = true; S.compare = []; toast('Toca dos jugadores para compararlos'); } rPlantilla(); };
  $$('.pcard').forEach(el => el.onclick = () => {
    const k = el.dataset.key;
    if (S.cmpMode) { S.compare = S.compare.includes(k) ? S.compare.filter(x => x !== k) : S.compare.concat(k).slice(-2); if (S.compare.length === 2) S.cmpMode = false; rPlantilla(); if (S.compare.length === 2) $('#cmpBox').scrollIntoView({ behavior: 'smooth' }); }
    else playerDialog(k);
  });
  if (S.compare.length === 2) renderCompare(P);

  const bym = P.filter(p => p.min > 0).sort((a, b) => b.min - a.min);
  chart('cMins', { type: 'bar', data: { labels: bym.map(p => p.short || p.name), datasets: [{ data: bym.map(p => +(p.min / Math.max(1, maxMin) * 100).toFixed(1)), backgroundColor: bym.map(p => POS_COLOR[p.pos]), borderRadius: 5 }] },
    options: { indexAxis: 'y', scales: { x: gridY({ max: 100, ticks: { callback: v => v + '%' } }), y: noGrid({ ticks: { autoSkip: false, font: { size: 10.5 } } }) }, plugins: { tooltip: { callbacks: { label: x => `${bym[x.dataIndex].min}' (${x.raw}%)` } } } } });
  const byg = P.filter(p => p.ga > 0).sort((a, b) => b.ga - a.ga || b.g - a.g);
  chart('cGA', { type: 'bar', data: { labels: byg.map(p => p.short || p.name), datasets: [{ label: 'Goles', data: byg.map(p => p.g), backgroundColor: c.zar, borderRadius: 4 }, { label: 'Asistencias', data: byg.map(p => p.a), backgroundColor: '#5b8cff', borderRadius: 4 }] },
    options: { plugins: { legend: { display: true, labels: { boxWidth: 12 } } }, scales: { x: noGrid({ stacked: true }), y: gridY({ stacked: true, ticks: { stepSize: 1 } }) } } });
  const eff = P.filter(p => p.min >= 90 && p.pos !== 'POR');
  chart('cEff', { type: 'scatter', data: { datasets: [{ data: eff.map(p => ({ x: p.min, y: +((p.g + p.a) / p.min * 90).toFixed(2), n: p.name })), backgroundColor: eff.map(p => POS_COLOR[p.pos]), pointRadius: 7, pointHoverRadius: 9 }] },
    options: { scales: { x: gridY({ title: { display: true, text: 'Minutos' } }), y: gridY({ title: { display: true, text: "G+A por 90'" }, beginAtZero: true }) }, plugins: { tooltip: { callbacks: { label: x => `${x.raw.n}: ${x.raw.x}' · ${fmt(x.raw.y, 2)} G+A/90` } } } } });

  // mapa de calor de minutos
  const js = zarMatches().filter(m => m.res).map(m => m.j);
  const rowsP = P.filter(p => p.pj > 0).sort((a, b) => b.min - a.min);
  $('#heat').innerHTML = `<div class="heat-grid" style="grid-template-columns:110px repeat(${js.length},1fr)"><span></span>${js.map(j => `<span class="hj">J${j}</span>`).join('')}${rowsP.map(p => `<span class="hn">${esc(p.short || p.name)}</span>${js.map(j => { const e = p.log.find(x => x.j === j); const v = e ? e.min / 90 : 0; return `<span class="hc" title="${esc(p.name)} · J${j}: ${e ? e.min + "'" : 'no jugó'}" style="background:${e ? `rgba(47,107,255,${.15 + v * .85})` : 'transparent'}">${e && e.start ? '▲' : ''}${e && e.g ? '⚽' : ''}</span>`; }).join('')}`).join('')}</div>`;
}
function renderCompare(P) {
  const [a, b] = S.compare.map(k => P.find(p => p.key === k)); if (!a || !b) return;
  const c = C(), per90 = (p, k) => p.min ? p[k] / p.min * 90 : 0;
  const metrics = [['Minutos', p => p.min], ['Partidos', p => p.pj], ['Titular', p => p.pt], ['Goles', p => p.g], ['Asist.', p => p.a], ['G+A/90', p => +(per90(p, 'ga')).toFixed(2)]];
  $('#cmpBox').innerHTML = `<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><h3>Cara a cara</h3><button class="btn ghost" id="cmpX">Cerrar</button></div>
  <div class="grid g2"><div class="chart-wrap"><canvas id="cCmp"></canvas></div>
  <div class="table-wrap"><table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${metrics.map(([k, f]) => { const va = f(a), vb = f(b); return `<tr><td class="t">${k}</td><td style="${va > vb ? 'font-weight:800;color:var(--ink)' : ''}">${va}</td><td style="${vb > va ? 'color:#e0a800;font-weight:800' : ''}">${vb}</td></tr>`; }).join('')}</tbody></table></div></div></div>`;
  $('#cmpX').onclick = () => { S.compare = []; rPlantilla(); };
  const mx = metrics.map(([, f]) => Math.max(f(a), f(b), 0.0001));
  chart('cCmp', { type: 'radar', data: { labels: metrics.map(m => m[0]), datasets: [
    { label: a.name, data: metrics.map(([, f], i) => +(f(a) / mx[i] * 100).toFixed(0)), borderColor: c.zar, backgroundColor: c.zarFill, borderWidth: 2 },
    { label: b.name, data: metrics.map(([, f], i) => +(f(b) / mx[i] * 100).toFixed(0)), borderColor: '#f2c14e', backgroundColor: '#f2c14e33', borderWidth: 2 }] },
    options: { plugins: { legend: { display: true } }, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: c.grid }, angleLines: { color: c.grid }, pointLabels: { color: c.ink } } } } });
}
function rankingDialog(kind) {
  const P = playerTotals(), maxMin = Math.max(1, lastRound() * 90);
  const og = zarMatches().filter(m => m.res).reduce((s, m) => { const d = matchDetail(m.j); return s + (d ? d.goals.filter(g => g.og).length : 0); }, 0);
  const cfg = kind === 'g'
    ? { title: 'Goleadores', rows: P.filter(p => p.g > 0).sort((a, b) => b.g - a.g || a.min - b.min), val: p => p.g, max: null,
        head: ['Goles', 'Pen.', "Min/gol", 'PJ'], cols: p => [`<b>${p.g}</b>`, p.pen || '–', p.g ? Math.round(p.min / p.g) + "'" : '–', p.pj],
        foot: `${sum(P, p => p.g)} goles de jugadores${og ? ` + ${og} en propia puerta del rival` : ''}.` }
    : { title: 'Minutos jugados', rows: P.filter(p => p.min > 0).sort((a, b) => b.min - a.min), val: p => p.min, max: maxMin,
        head: ['Min', '%', 'PJ', 'Tit.'], cols: p => [`<b>${p.min}'</b>`, Math.round(p.min / maxMin * 100) + '%', p.pj, p.pt],
        foot: `Sobre ${maxMin}' posibles (${lastRound()} jornadas).` };
  const top = Math.max(...cfg.rows.map(cfg.val), 1);
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body">
    <div class="dlg-head"><h2 style="font-size:28px">${cfg.title}</h2><button class="x" onclick="this.closest('dialog').close()">✕</button></div>
    <div class="table-wrap"><table class="rank">
      <thead><tr><th>#</th><th style="text-align:left">Jugador</th>${cfg.head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${cfg.rows.map((p, i) => { const prev = i ? cfg.val(cfg.rows[i - 1]) : null; const pos = prev === cfg.val(p) ? '' : i + 1; return `<tr data-key="${esc(p.key)}"><td>${pos}</td><td class="t">${avatar(p, 30)}<div class="rk-name"><span>${esc(p.name)}</span><i class="rk-bar"><i style="width:${cfg.val(p) / top * 100}%"></i></i></div></td>${cfg.cols(p).map(c => `<td>${c}</td>`).join('')}</tr>`; }).join('')}</tbody>
    </table></div>
    <p class="muted small" style="margin-top:10px">${cfg.foot} Toca un jugador para ver su ficha.</p>
  </div>`;
  dlg.showModal();
  $$('#dlg tr[data-key]').forEach(tr => tr.onclick = () => { dlg.close(); playerDialog(tr.dataset.key); });
}
function playerDialog(key) {
  const c = C(), P = playerTotals(), p = P.find(x => x.key === key) || { ...player(key), min: 0, pj: 0, pt: 0, g: 0, a: 0, y: 0, r: 0, log: [] }, maxMin = lastRound() * 90;
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body">
    <div class="dlg-head"><div class="row">${avatar(p, 64)}<div><h2 style="font-size:28px">${esc(p.name)}</h2><div class="muted small">${POS_NAME[p.pos] || ''}${p.n ? ' · dorsal ' + p.n : ''}</div></div></div><button class="x" onclick="this.closest('dialog').close()">✕</button></div>
    <div class="grid g4">
      <div class="card kpi"><span class="k">Minutos</span><span class="v">${p.min}</span><span class="d">${Math.round(p.min / Math.max(1, maxMin) * 100)}% del total</span></div>
      <div class="card kpi"><span class="k">Partidos</span><span class="v">${p.pj}</span><span class="d">${p.pt} de titular</span></div>
      <div class="card kpi"><span class="k">Goles</span><span class="v">${p.g}</span><span class="d">${p.min ? fmt(p.g / p.min * 90, 2) : '–'} por 90'${p.pen ? ` · ${p.pen} pen.` : ''}</span></div>
      <div class="card kpi"><span class="k">Asistencias</span><span class="v">${p.a}</span><span class="d">${p.min ? fmt(p.a / p.min * 90, 2) : '–'} por 90'</span></div>
    </div>
    <div class="row" style="margin-top:10px"><span class="pill"><i class="cardY"></i> ${p.y} amarillas</span><span class="pill"><i class="cardR"></i> ${p.r} expulsiones</span>${p.min ? `<span class="pill">1 gol cada ${p.g ? Math.round(p.min / p.g) + "'" : '—'}</span>` : ''}</div>
    ${p.log.length ? `<h3 style="margin-top:14px;font-size:20px">Partido a partido</h3><div class="chart-wrap short"><canvas id="cPlog"></canvas></div><div class="legend"><span><i style="background:${c.zar}"></i>Titular</span><span><i style="background:#5b8cff"></i>Suplente</span></div>` : `<p class="muted small" style="margin-top:14px">Todavía no ha jugado.</p>`}
    <label style="margin-top:14px">URL de foto (opcional, sustituye a la oficial)<input id="photoUrl" placeholder="https://…" value="${esc(S.user.photos[p.key] || '')}"></label>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="savePhoto">Guardar foto</button></div>
  </div>`;
  dlg.showModal();
  $('#savePhoto').onclick = () => { const v = $('#photoUrl').value.trim(); if (v) S.user.photos[p.key] = v; else delete S.user.photos[p.key]; saveUser(); dlg.close(); renderAll(); toast('Foto guardada'); };
  if (p.log.length) {
    const L = [...p.log].sort((a, b) => a.j - b.j);
    chart('cPlog', { type: 'bar', data: { labels: L.map(x => 'J' + x.j), datasets: [{ data: L.map(x => x.min), backgroundColor: L.map(x => x.start ? c.zar : '#5b8cff'), borderRadius: 5 }] },
      options: { scales: { y: gridY({ max: 95 }), x: noGrid() }, plugins: { tooltip: { callbacks: { label: x => { const e = L[x.dataIndex]; return `${e.min}' · ${team(e.opp).name} ${e.start ? '(titular)' : '(suplente)'}${e.g ? ' · ⚽' + e.g : ''}${e.a ? ' · 🅰️' + e.a : ''}${e.y ? ' · 🟨' : ''}${e.r ? ' · 🟥' : ''}`; } } } } } });
  }
}

/* ---------- ACTA ---------- */
function rActa() {
  const ms = zarMatches();
  const firstPending = ms.find(m => m.res && !official(m.j) && !S.user.actas[m.j]) || ms.find(m => m.res && official(m.j) && officialNeedsAssists(m.j)) || ms.find(m => !m.res) || ms[ms.length - 1];
  const def = S.actaJ || firstPending.j; S.actaJ = def;
  const m = ms.find(x => x.j === def);
  const sel = `<label>Jornada<select id="aJ">${ms.map(x => `<option value="${x.j}" ${x.j === def ? 'selected' : ''}>J${x.j} · ${esc(team(x.opp).name)} (${x.home ? 'casa' : 'fuera'})${official(x.j) ? ' ✓ oficial' : S.user.actas[x.j] ? ' 📝' : ''}</option>`).join('')}</select></label>`;
  $('#view-acta').innerHTML = `<div class="section-title"><h2>Acta del partido</h2><small>${official(def) ? 'Datos oficiales cargados' : 'Registro manual'}</small></div>
    <div class="card">${official(def) ? actaOfficial(def, m, sel) : actaManual(def, m, sel)}</div>${settingsCard()}`;
  $('#aJ').onchange = e => { S.actaJ = +e.target.value; rActa(); };
  if (official(def)) bindActaOfficial(def); else bindActaManual(def, m);
  bindSettings();
}
function officialNeedsAssists(j) { const d = matchDetail(j); return j > S.squad.assistsBase.upto && d && d.goals.some(g => !g.og) && !S.user.assists[j]; }
function actaOfficial(j, m, sel) {
  const d = matchDetail(j), ext = S.user.extra[j] || {};
  const names = allPlayers();
  const opts = v => `<option value="">Sin asistencia / no sé</option>` + names.map(p => `<option value="${p.key}" ${p.key === v ? 'selected' : ''}>${p.n ?? ''} ${esc(p.name)}</option>`).join('');
  const goals = d.goals.map((g, i) => ({ ...g, i })).filter(g => !g.og);
  return `<div class="form-grid">${sel}<label>Resultado<input value="${m.home ? m.gf + '-' + m.ga : m.ga + '-' + m.gf} (oficial)" disabled></label></div>
    <p class="note" style="margin-top:12px">Este partido ya está cargado desde <b>realzaragoza.com</b>: once, cambios, goles, tarjetas y estadísticas. Solo falta lo que la web oficial no publica.</p>
    <h3 style="margin-top:16px">Asistencias</h3>
    ${goals.length ? goals.map(g => `<div class="ev" style="grid-template-columns:1fr 1.4fr"><div class="pill" style="justify-content:flex-start">⚽ ${g.min}' ${esc(player(g.player).name)}${g.pen ? ' (pen.)' : ''}</div><select data-goal="${g.i}">${opts((S.user.assists[j] || {})[g.i])}</select></div>`).join('') : '<p class="muted small">El Zaragoza no marcó (o solo hubo goles en propia puerta).</p>'}
    ${j <= S.squad.assistsBase.upto ? `<p class="muted small">Hasta la J${S.squad.assistsBase.upto} las asistencias de la plantilla ya vienen de AupaZaragoza; lo que pongas aquí solo se ve en la ficha del partido.</p>` : ''}
    <h3 style="margin-top:16px">xG (opcional)</h3>
    <div class="form-grid"><label>xG Zaragoza<input type="number" step="0.01" id="xgZ" value="${ext.xg?.z ?? ''}"></label><label>xG rival<input type="number" step="0.01" id="xgO" value="${ext.xg?.o ?? ''}"></label></div>
    <div class="row" style="justify-content:space-between;margin-top:16px"><button class="btn" id="seeMatch">Ver ficha del partido</button><button class="btn primary" id="aSave">Guardar</button></div>`;
}
function bindActaOfficial(j) {
  $('#seeMatch').onclick = () => matchDialog(j);
  $('#aSave').onclick = () => {
    const as = {}; $$('[data-goal]').forEach(s => { if (s.value) as[s.dataset.goal] = s.value; });
    if (Object.keys(as).length) S.user.assists[j] = as; else delete S.user.assists[j];
    const z = $('#xgZ').value, o = $('#xgO').value;
    if (z !== '' || o !== '') S.user.extra[j] = { ...(S.user.extra[j] || {}), xg: { z: z === '' ? null : +z, o: o === '' ? null : +o } };
    saveUser(); toast('Guardado ✓'); rActa();
  };
}
function actaManual(def, m, sel) {
  const a = S.user.actas[def] || { starters: [], subs: [], goals: [], cards: [], stats: {}, len: 90 };
  const ps = allPlayers().filter(p => p.first || p.pos === 'FIL');
  const opt = (v, ph) => `<option value="">${ph}</option>` + ps.map(p => `<option value="${p.key}" ${p.key === v ? 'selected' : ''}>${p.n ?? ''} ${esc(p.name)}</option>`).join('');
  const stat = (k, lbl) => `<label>${lbl}<div class="row" style="flex-wrap:nowrap"><input type="number" step="any" data-stat="${k}.z" placeholder="RZ" value="${a.stats?.[k]?.z ?? ''}"><input type="number" step="any" data-stat="${k}.o" placeholder="Rival" value="${a.stats?.[k]?.o ?? ''}"></div></label>`;
  return `<div class="form-grid">${sel}<label>Duración (min)<input id="aLen" type="number" value="${a.len || 90}"></label>
      <label>Goles Zaragoza<input id="aGF" type="number" min="0" value="${m.gf ?? ''}"></label><label>Goles ${esc(team(m.opp).short)}<input id="aGA" type="number" min="0" value="${m.ga ?? ''}"></label></div>
    <p class="note" style="margin-top:12px">Normalmente no hará falta: la web oficial publica el acta tras el partido y la app la carga sola. Úsalo solo si quieres adelantarte.</p>
    <h3 style="margin-top:16px">Once inicial <small class="muted" id="cnt11" style="font-family:Inter;font-size:12px"></small></h3>
    <div class="chips" id="aStart">${ps.map(p => `<button class="chip-toggle ${a.starters.includes(p.key) ? 'on' : ''}" data-k="${p.key}">${p.n ?? ''} ${esc(p.short || p.name)}</button>`).join('')}</div>
    <h3 style="margin-top:16px">Cambios</h3>
    <div id="aSubs">${(a.subs.length ? a.subs : [{}]).map(s => `<div class="ev"><select data-f="out">${opt(s.out, 'Sale')}</select><select data-f="in">${opt(s.in, 'Entra')}</select><input data-f="min" type="number" placeholder="Min" value="${s.min ?? ''}"><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="subs">+ Cambio</button>
    <h3 style="margin-top:16px">Goles del Zaragoza</h3>
    <div id="aGoals">${(a.goals.length ? a.goals : [{}]).map(g => `<div class="ev goal"><select data-f="player">${opt(g.player, 'Goleador')}</select><select data-f="assist">${opt(g.assist, 'Asistencia')}</select><input data-f="min" type="number" placeholder="Min" value="${g.min ?? ''}"><select data-f="kind"><option value="">Normal</option><option value="pen" ${g.pen ? 'selected' : ''}>Penalti</option><option value="og" ${g.og ? 'selected' : ''}>En propia</option></select><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="goals">+ Gol</button>
    <h3 style="margin-top:16px">Tarjetas</h3>
    <div id="aCards">${(a.cards.length ? a.cards : [{}]).map(cd => `<div class="ev"><select data-f="player">${opt(cd.player, 'Jugador')}</select><select data-f="type"><option value="Y" ${cd.type === 'Y' ? 'selected' : ''}>🟨 Amarilla</option><option value="YR" ${cd.type === 'YR' ? 'selected' : ''}>🟨🟥 Doble amarilla</option><option value="R" ${cd.type === 'R' ? 'selected' : ''}>🟥 Roja directa</option></select><input data-f="min" type="number" placeholder="Min" value="${cd.min ?? ''}"><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="cards">+ Tarjeta</button>
    <h3 style="margin-top:16px">Estadísticas <small class="muted" style="font-family:Inter;font-size:12px">(opcional)</small></h3>
    <div class="form-grid">${stat('xg', 'xG')}${stat('pos', 'Posesión %')}${stat('shots', 'Tiros')}${stat('sot', 'Tiros a puerta')}${stat('corners', 'Córners')}${stat('fouls', 'Faltas')}${stat('tackles', 'Entradas')}</div>
    <div class="row" style="justify-content:space-between;margin-top:18px">${S.user.actas[def] ? '<button class="btn danger" id="aDel">Borrar acta</button>' : '<span></span>'}<button class="btn primary" id="aSave">Guardar acta</button></div>`;
}
function bindActaManual(def, m) {
  const upd11 = () => { const k = $$('#aStart .on').length; $('#cnt11').textContent = `${k}/11`; $('#cnt11').style.color = k === 11 ? 'var(--win)' : 'var(--ink3)'; };
  upd11();
  $$('#aStart .chip-toggle').forEach(b => b.onclick = () => { b.classList.toggle('on'); upd11(); });
  const bindDel = () => $$('[data-del]').forEach(b => b.onclick = () => { const row = b.closest('.ev'); if (row.parentElement.children.length > 1) row.remove(); else $$('select,input', row).forEach(i => i.value = ''); });
  $$('[data-add]').forEach(b => b.onclick = () => { const box = { subs: '#aSubs', goals: '#aGoals', cards: '#aCards' }[b.dataset.add]; const first = $(box).firstElementChild.cloneNode(true); $$('select,input', first).forEach(i => i.value = ''); $(box).appendChild(first); bindDel(); });
  bindDel();
  $('#aSave').onclick = () => saveActa(m);
  if ($('#aDel')) $('#aDel').onclick = () => { const b = $('#aDel'); if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = '¿Seguro? Pulsa otra vez'; return; } delete S.user.actas[def]; saveUser(); toast('Acta borrada'); rActa(); };
}
function rows(sel, fields) { return $$(sel + ' .ev').map(r => { const o = {}; fields.forEach(f => { const el = $(`[data-f="${f}"]`, r); o[f] = el ? el.value : ''; }); return o; }); }
function saveActa(m) {
  const gf = $('#aGF').value, ga = $('#aGA').value;
  const starters = $$('#aStart .on').map(b => b.dataset.k);
  const subs = rows('#aSubs', ['out', 'in', 'min']).filter(s => s.out && s.min !== '').map(s => ({ out: s.out, in: s.in || null, min: +s.min }));
  const goals = rows('#aGoals', ['player', 'assist', 'min', 'kind']).filter(g => g.player || g.kind === 'og').map(g => ({ player: g.player || null, assist: g.assist || null, min: g.min === '' ? null : +g.min, pen: g.kind === 'pen', og: g.kind === 'og' }));
  const cards = rows('#aCards', ['player', 'type', 'min']).filter(cd => cd.player).map(cd => ({ player: cd.player, type: cd.type, min: cd.min === '' ? null : +cd.min }));
  const stats = {}; $$('[data-stat]').forEach(i => { if (i.value === '') return; const [k, s] = i.dataset.stat.split('.'); (stats[k] = stats[k] || {})[s] = +i.value; });
  if (starters.length && starters.length !== 11) { toast(`El once tiene ${starters.length} jugadores. Revisa antes de guardar.`); return; }
  if (gf !== '' && goals.length && goals.length !== +gf) toast(`Aviso: marcador ${gf} goles y ${goals.length} goles registrados`, 3500);
  S.user.actas[m.j] = { starters, subs, goals, cards, stats, len: +$('#aLen').value || 90, savedAt: new Date().toISOString() };
  if (gf !== '' && ga !== '') S.user.results[`${m.h}_${m.a}`] = m.home ? [+gf, +ga] : [+ga, +gf];
  saveUser(); toast('Acta de la J' + m.j + ' guardada ✓'); rActa();
}

/* ---------- ajustes, exportar, GitHub ---------- */
function settingsCard() {
  const c = S.cfg;
  return `<div class="card" style="margin-top:14px"><h3>Datos y sincronización</h3>
    <p class="muted small" style="margin-top:-4px">Lo que añades (asistencias, xG, actas, fotos) se guarda en este dispositivo. Con GitHub configurado también se guarda en el repositorio (<code>data/user.json</code>) y, al pulsar Actualizar, la app pide a GitHub que descargue en ese momento los datos de la web oficial.</p>
    <div class="form-grid">
      <label>Repositorio (usuario/repo)<input id="cfgRepo" placeholder="fjaenj/real-zaragoza-stats" value="${esc(c.repo || '')}"></label>
      <label>Rama<input id="cfgBranch" placeholder="main" value="${esc(c.branch || 'main')}"></label>
      <label style="grid-column:1/-1">Token de GitHub (solo se guarda en este dispositivo)<input id="cfgToken" type="password" placeholder="github_pat_…" value="${esc(c.token || '')}"></label>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="cfgSave">Guardar ajustes</button><button class="btn" id="ghPush">Subir ahora</button><button class="btn" id="exp">Exportar JSON</button><label class="btn" style="flex-direction:row;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink)">Importar<input type="file" id="imp" accept="application/json" hidden></label></div>
    <p class="muted small" style="margin-top:10px">Token: GitHub → Settings → Developer settings → Fine-grained tokens → acceso solo a este repositorio con permisos <i>Contents: Read and write</i> y <i>Actions: Read and write</i>.</p></div>`;
}
function bindSettings() {
  $('#cfgSave').onclick = () => { S.cfg = { repo: $('#cfgRepo').value.trim(), branch: $('#cfgBranch').value.trim() || 'main', token: $('#cfgToken').value.trim() }; lsSet(LS_CFG, S.cfg); toast('Ajustes guardados'); };
  $('#ghPush').onclick = () => ghSave().then(() => toast('Guardado en GitHub ✓')).catch(e => toast('Error GitHub: ' + e.message, 4000));
  $('#exp').onclick = () => { const b = new Blob([JSON.stringify(S.user, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'nobleza-y-valor-datos.json'; a.click(); };
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.actas) throw new Error('formato'); S.user = migrateUser(d); saveUser(false); toast('Datos importados'); renderAll(); } catch { toast('Archivo no válido'); } };
}
function ghHeaders() { return { Authorization: 'Bearer ' + S.cfg.token, Accept: 'application/vnd.github+json' }; }
async function ghSave() {
  const { repo, token, branch = 'main' } = S.cfg; if (!repo || !token) throw new Error('falta configurar repo/token');
  const url = `https://api.github.com/repos/${repo}/contents/data/user.json`;
  let sha; const g = await fetch(url + '?ref=' + encodeURIComponent(branch), { headers: ghHeaders() }); if (g.ok) sha = (await g.json()).sha;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(S.user, null, 1))));
  const r = await fetch(url, { method: 'PUT', headers: ghHeaders(), body: JSON.stringify({ message: 'Actualizar datos ' + new Date().toISOString().slice(0, 16), content, sha, branch }) });
  if (!r.ok) throw new Error(r.status + ' ' + ((await r.json()).message || ''));
}
async function ghDispatch() {
  const { repo, token, branch = 'main' } = S.cfg; if (!repo || !token) return false;
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', headers: ghHeaders(), body: JSON.stringify({ ref: branch }) });
  return r.status === 204;
}

/* ---------- actualización ---------- */
const WIKI = {
  en: { page: '2026–27_Primera_Federación', module: /\{\{\s*#invoke:\s*sports results/i, match: /\|\s*match_([A-Z0-9]+)_([A-Z0-9]+)\s*=\s*([^\n|}]*)/g, key: 'en' },
  es: { page: 'Primera_Federación_2026-27', module: /\{\{\s*#invoke:\s*football results/i, match: /\|\s*partido_([A-Z0-9]+)_([A-Z0-9]+)\s*=\s*([^\n|}]*)/g, key: 'es' }
};
async function wikiResults(lang) {
  const W = WIKI[lang];
  const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(W.page)}&prop=wikitext&format=json&formatversion=2&origin=*`;
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
  const txt = (await r.json()).parse.wikitext;
  const parts = txt.split(W.module).slice(1).map(b => { const i = b.search(/\n\}\}/); return i >= 0 ? b.slice(0, i + 1) : b; });
  const mine = S.season.teams.find(t => t.code === S.season.team)[W.key];
  const block = parts.find(b => new RegExp(`(name|nombre)_${mine}\\s*=`).test(b));
  if (!block) throw new Error('no encuentro la tabla del grupo');
  const back = {}; S.season.teams.forEach(t => back[t[W.key]] = t.code);
  const out = {};
  for (const m of block.matchAll(W.match)) {
    const h = back[m[1]], a = back[m[2]]; if (!h || !a) continue;
    const sc = m[3].replace(/<[^>]*>|\[\[[^\]]*\]\]|\{\{[^}]*\}\}/g, ' ').match(/^\s*(\d+)\s*[–−-]\s*(\d+)/);
    if (sc) out[`${h}_${a}`] = [+sc[1], +sc[2]];
  }
  return out;
}
async function updateFromWikipedia({ silent = false } = {}) {
  const got = {}, errs = [];
  for (const lang of ['es', 'en']) { try { Object.assign(got, await wikiResults(lang)); } catch (e) { errs.push(lang + ': ' + e.message); } }
  if (!Object.keys(got).length) throw new Error(errs.join(' · ') || 'sin datos');
  const before = new Map(fixtures().map(f => [`${f.h}_${f.a}`, f.hg == null ? null : f.hg + '-' + f.ag]));
  const fresh = [];
  Object.entries(got).forEach(([k, v]) => {
    const base = S.season.fixtures.find(f => `${f.h}_${f.a}` === k); if (!base) return;
    const zarGame = base.h === S.season.team || base.a === S.season.team;
    if (zarGame && (officialFinal(base.j) || (S.user.actas[base.j] && S.user.results[k]))) return; // manda la web oficial / tu acta
    const wasManual = (S.user.manual || {})[k]; if (wasManual) delete S.user.manual[k];
    if (base.hg === v[0] && base.ag === v[1]) delete S.user.results[k]; else S.user.results[k] = v;
    if (wasManual && before.get(k) === v[0] + '-' + v[1]) return; // ya lo tenías bien metido a mano
    if (before.get(k) !== v[0] + '-' + v[1]) fresh.push(`${team(base.h).short} ${v[0]}-${v[1]} ${team(base.a).short}`);
  });
  S.user.wikiAt = new Date().toISOString();
  saveUser(fresh.length > 0);
  if (fresh.length) renderAll();
  if (!silent) return fresh;
  if (fresh.length) toast(`${fresh.length} resultado${fresh.length > 1 ? 's' : ''} nuevo${fresh.length > 1 ? 's' : ''}: ${fresh.slice(0, 3).join(' · ')}${fresh.length > 3 ? '…' : ''}`, 4500);
  return fresh;
}
async function updateAll() {
  const b = $('#btnUpdate'); b.classList.add('loading'); b.disabled = true;
  const msgs = [];
  try {
    const [remote, off, sch] = await Promise.all([loadJSON('data/user.json?t=' + Date.now(), true), loadJSON('data/official.json?t=' + Date.now(), true), loadJSON('data/schedule.json?t=' + Date.now(), true)]);
    if (sch && (sch.updated || '') > ((S.schedule || {}).updated || '')) {
      const cnt = o => Object.values((o && o.rfef) || {}).reduce((n, x) => n + ((x.rows || []).length), 0);
      const nNew = cnt(sch) - cnt(S.schedule); S.schedule = sch;
      if (nNew > 0) msgs.push(`${nNew} horario${nNew > 1 ? 's' : ''} nuevo${nNew > 1 ? 's' : ''}`);
    }
    if (remote && new Date(remote.updatedAt || 0) > new Date(S.user.updatedAt || 0)) { S.user = migrateUser(remote); lsSet(LS_USER, S.user); }
    if (off && (off.updated || '') > (S.official.updated || '')) {
      const before = Object.values(S.official.matches || {}).filter(m => m.finished).length;
      S.official = off;
      const now = Object.values(off.matches).filter(m => m.finished).length;
      msgs.push(now > before ? `${now - before} partido${now - before > 1 ? 's' : ''} oficial${now - before > 1 ? 'es' : ''} nuevo${now - before > 1 ? 's' : ''}` : 'datos oficiales al día');
    }
    const fresh = await updateFromWikipedia().catch(e => { msgs.push('Wikipedia: ' + e.message); return []; });
    if (fresh.length) msgs.push(`${fresh.length} resultado${fresh.length > 1 ? 's' : ''} nuevo${fresh.length > 1 ? 's' : ''}: ${fresh.slice(0, 3).join(' · ')}${fresh.length > 3 ? '…' : ''}`);
    if (await ghDispatch().catch(() => false)) msgs.push('pedido a la web oficial: vuelve a pulsar en 2-3 min');
    toast(msgs.length ? msgs.join(' · ') : 'Todo al día', 5000);
  } catch (e) { toast('No se pudo actualizar: ' + e.message, 4000); }
  finally { b.classList.remove('loading'); b.disabled = false; renderAll(); }
}

boot().catch(e => { document.getElementById('app').innerHTML = `<div class="card"><h3>Error al cargar</h3><p class="muted">${esc(e.message)}</p></div>`; console.error(e); });
