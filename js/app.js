/* Blanquillos 26/27 · seguimiento estadístico del Real Zaragoza */
'use strict';

const LS_USER = 'rz2627_user';
const LS_CFG = 'rz2627_cfg';
const S = { season: null, history: null, user: null, cfg: {}, charts: {}, view: 'inicio', champMode: 'last4', compare: [], sortBy: 'min', posFilter: 'ALL' };

const CHAMP_COLORS = { 'Tenerife': '#ff5a5f', 'Eldense': '#f5b83d', 'Cultural Leonesa': '#3ccf7a', 'Ceuta': '#a77bff', 'Deportivo': '#7aa2ff', 'Castellón': '#b6f36b', 'Racing de Ferrol': '#5fd0ff', 'Amorebieta': '#ff8bd1' };
const CHAMP_ABBR = { 'Tenerife': 'TEN', 'Eldense': 'ELD', 'Cultural Leonesa': 'CUL', 'Ceuta': 'CEU', 'Deportivo': 'DEP', 'Castellón': 'CAS', 'Racing de Ferrol': 'RFE', 'Amorebieta': 'AMO' };
const ZAR_COLOR = '#ffffff';
const POS_NAME = { POR: 'Portero', DEF: 'Defensa', MED: 'Centrocampista', DEL: 'Delantero' };

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fmt = (n, d = 2) => (n == null || isNaN(n)) ? '–' : Number(n).toFixed(d).replace('.', ',');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }
function initials(name) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function dateES(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y.slice(2)}`; }

/* ---------- carga de datos ---------- */
async function loadJSON(url, optional = false) {
  try { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { if (optional) return null; throw e; }
}
function emptyUser() { return { v: 1, updatedAt: null, results: {}, actas: {}, photos: {}, wikiAt: null }; }

async function boot() {
  [S.season, S.history] = await Promise.all([loadJSON('data/season.json'), loadJSON('data/history.json')]);
  const remote = await loadJSON('data/user.json', true);
  const local = lsGet(LS_USER, null);
  S.user = pickNewer(remote, local) || emptyUser();
  S.cfg = lsGet(LS_CFG, {});
  setupChartDefaults();
  bindNav();
  $('#btnUpdate').addEventListener('click', updateAll);
  renderAll();
  // actualización silenciosa al abrir si hace más de 6 h
  const last = S.user.wikiAt ? new Date(S.user.wikiAt).getTime() : 0;
  if (Date.now() - last > 6 * 3600e3) updateFromWikipedia({ silent: true }).catch(() => { });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
}
function pickNewer(a, b) {
  if (!a) return b; if (!b) return a;
  return (new Date(a.updatedAt || 0) >= new Date(b.updatedAt || 0)) ? a : b;
}
function saveUser(syncRemote = true) {
  S.user.updatedAt = new Date().toISOString();
  lsSet(LS_USER, S.user);
  if (syncRemote && S.cfg.token && S.cfg.repo) ghSave().catch(e => toast('No se pudo guardar en GitHub: ' + e.message, 4000));
}

/* ---------- modelo ---------- */
const team = code => S.season.teams.find(t => t.code === code) || { short: code, code };
function fixtures() {
  return S.season.fixtures.map(f => {
    const k = `${f.h}_${f.a}`, o = S.user.results[k];
    return o ? { ...f, hg: o[0], ag: o[1] } : f;
  });
}
function zarMatches() {
  const me = S.season.team;
  return fixtures().filter(f => f.h === me || f.a === me).sort((a, b) => a.j - b.j).map(f => {
    const home = f.h === me, played = f.hg != null;
    const gf = played ? (home ? f.hg : f.ag) : null, ga = played ? (home ? f.ag : f.hg) : null;
    const res = !played ? null : gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    return { ...f, home, opp: home ? f.a : f.h, gf, ga, res, pts: res === 'W' ? 3 : res === 'D' ? 1 : res === 'L' ? 0 : null };
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
  return Object.values(T).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || team(a.code).short.localeCompare(team(b.code).short))
    .map((s, i) => ({ ...s, pos: i + 1 }));
}
function lastRound() { const z = zarMatches().filter(m => m.res); return z.length ? Math.max(...z.map(m => m.j)) : 0; }
function zarCumulative() { let a = 0; return zarMatches().filter(m => m.res).map(m => (a += m.pts)); }
function positionsByRound() { const n = lastRound(), out = []; for (let j = 1; j <= n; j++) out.push(standings(j).find(s => s.code === S.season.team).pos); return out; }

/* ---------- jugadores ---------- */
function playerTotals() {
  const base = S.season.baseRound;
  const map = new Map(S.season.players.map(p => [p.name, { ...p, min: p.base.min, pj: p.base.pj, pt: p.base.pt, g: p.base.g, a: p.base.a, y: null, r: null, log: [] }]));
  let hasCards = false;
  Object.entries(S.user.actas).forEach(([j, acta]) => {
    j = +j;
    const mins = actaMinutes(acta);
    Object.entries(mins).forEach(([name, m]) => {
      const p = map.get(name); if (!p) return;
      const g = (acta.goals || []).filter(x => x.player === name && !x.og).length;
      const a = (acta.goals || []).filter(x => x.assist === name).length;
      const y = (acta.cards || []).filter(x => x.player === name && x.type === 'Y').length;
      const r = (acta.cards || []).filter(x => x.player === name && (x.type === 'R' || x.type === 'YR')).length;
      p.log.push({ j, min: m.min, start: m.start, g, a, y, r });
      if (j > base) { p.min += m.min; p.pj += m.min > 0 ? 1 : 0; p.pt += m.start ? 1 : 0; p.g += g; p.a += a; }
      if (y || r) hasCards = true;
      p.y = (p.y || 0) + y; p.r = (p.r || 0) + r;
    });
  });
  const arr = [...map.values()].map(p => ({ ...p, photo: S.user.photos[p.name] || p.photo || null, ga: p.g + p.a }));
  arr.hasCards = hasCards;
  return arr;
}
function actaMinutes(acta) {
  const len = +acta.len || 90, out = {};
  (acta.starters || []).forEach(n => out[n] = { min: len, start: true, from: 0 });
  (acta.subs || []).forEach(s => {
    if (out[s.out]) out[s.out].min = Math.max(0, Math.min(len, +s.min) - out[s.out].from);
    if (s.in) out[s.in] = { min: Math.max(0, len - Math.min(len, +s.min)), start: false, from: Math.min(len, +s.min) };
  });
  (acta.cards || []).filter(c => c.type === 'R' || c.type === 'YR').forEach(c => {
    const p = out[c.player]; if (p) p.min = Math.max(0, Math.min(p.from + p.min, Math.min(len, +c.min)) - p.from);
  });
  Object.values(out).forEach(p => p.min = Math.round(p.min));
  return out;
}

/* ---------- navegación ---------- */
function bindNav() {
  $$('#tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  const h = location.hash.replace('#', ''); if (h && $('#view-' + h)) go(h);
}
function go(v) {
  S.view = v; history.replaceState(null, '', '#' + v);
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
  window.scrollTo({ top: 0, behavior: 'instant' });
  renderView(v);
}
function renderAll() { renderView(S.view); }
function renderView(v) {
  ({ inicio: rInicio, temporada: rTemporada, campeones: rCampeones, micro: rMicro, plantilla: rPlantilla, acta: rActa })[v]();
}

/* ---------- gráficos ---------- */
function setupChartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = '#a9b8de';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = '#22366a';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = '#ffffff';
  Chart.defaults.plugins.tooltip.titleColor = '#0a1430';
  Chart.defaults.plugins.tooltip.bodyColor = '#0a1430';
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

/* ---------- INICIO ---------- */
function rInicio() {
  const ms = zarMatches(), played = ms.filter(m => m.res), st = standings(), me = st.find(s => s.code === S.season.team);
  const n = played.length, ppg = n ? me.pts / n : 0, proj = ppg * 38;
  const next = ms.find(m => !m.res);
  const form = played.slice(-5);
  const home = played.filter(m => m.home), away = played.filter(m => !m.home);
  const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
  const cs = played.filter(m => m.ga === 0).length;
  const leader = st[0], second = st[1], fifth = st[4], sixth = st[5];
  const gapTop = me.pos === 1 ? me.pts - second.pts : me.pts - leader.pts;
  const gap6 = me.pts - sixth.pts;
  const blk = microBlocks().find(b => b.status === 'live') || microBlocks().filter(b => b.played).slice(-1)[0];
  const champs = S.history.seasons;
  const avgChampAtN = n ? champs.reduce((s, c) => s + c.curve[n - 1], 0) / champs.length : 0;

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
      ${next ? `<div class="sub">Jornada ${next.j} · ${dateES(next.date)} (fecha de jornada)</div>
      <div class="next">
        <div class="team"><div class="badge ${next.home ? 'zar' : ''}">${next.home ? 'RZ' : esc(team(next.opp).code)}</div>${esc(next.home ? 'Real Zaragoza' : team(next.opp).short)}</div>
        <div class="vs">VS</div>
        <div class="team"><div class="badge ${!next.home ? 'zar' : ''}">${!next.home ? 'RZ' : esc(team(next.opp).code)}</div>${esc(!next.home ? 'Real Zaragoza' : team(next.opp).short)}</div>
      </div>
      <div class="row" style="justify-content:center;margin-top:12px">${oppInfo(next.opp)}</div>` : '<p class="muted">Temporada terminada</p>'}
    </div>
    <div class="card">
      <h3>Microobjetivo actual</h3>
      ${blk ? blockCard(blk, true) : ''}
    </div>
  </div>

  <div class="grid g4" style="margin-top:14px">
    <div class="card kpi"><span class="k">vs media campeones</span><span class="v ${me.pts - avgChampAtN >= 0 ? 'up' : 'down'}">${me.pts - avgChampAtN >= 0 ? '+' : ''}${fmt(me.pts - avgChampAtN, 1)}</span><span class="d">Media en J${n}: ${fmt(avgChampAtN, 1)} pts</span></div>
    <div class="card kpi"><span class="k">Colchón play-off</span><span class="v ${gap6 >= 0 ? 'up' : 'down'}">${gap6 >= 0 ? '+' : ''}${gap6}</span><span class="d">sobre el 6º (${esc(team(sixth.code).short)})</span></div>
    <div class="card kpi"><span class="k">Casa / Fuera</span><span class="v">${sum(home, 'pts')}·${sum(away, 'pts')}</span><span class="d">${home.length} y ${away.length} partidos</span></div>
    <div class="card kpi"><span class="k">Porterías a cero</span><span class="v">${cs}</span><span class="d">${fmt(me.ga / Math.max(1, n), 2)} goles encajados/partido</span></div>
  </div>

  <div class="card" style="margin-top:14px">
    <h3>Ritmo de puntos</h3>
    <div class="sub">Zaragoza frente a la media de los 8 últimos campeones y a la línea de microobjetivos (7 pts cada 4 partidos)</div>
    <div class="chart-wrap short"><canvas id="cHomeRace"></canvas></div>
    <div class="legend"><span><i style="background:#fff"></i>Zaragoza</span><span><i style="background:#f2c14e"></i>Media campeones</span><span><i style="background:#5b8cff"></i>Microobjetivos</span></div>
  </div>
  <p class="footer-src">${esc(S.season.source)}<br>Última actualización de resultados: ${S.user.wikiAt ? new Date(S.user.wikiAt).toLocaleString('es-ES') : 'datos base ' + dateES(S.season.updated)}</p>`;

  const cum = zarCumulative();
  const N = Math.max(cum.length + 4, 14);
  const avg = Array.from({ length: N }, (_, i) => +(champs.reduce((s, c) => s + c.curve[i], 0) / champs.length).toFixed(2));
  chart('cHomeRace', {
    type: 'line',
    data: { labels: jLabels(N), datasets: [
      { data: cum, borderColor: '#fff', backgroundColor: '#ffffff22', borderWidth: 3, pointRadius: 3, tension: .25, fill: false },
      { data: avg, borderColor: '#f2c14e', borderWidth: 2, pointRadius: 0, borderDash: [6, 4], tension: .25 },
      { data: Array.from({ length: N }, (_, i) => +((i + 1) * 7 / 4).toFixed(2)), borderColor: '#5b8cff', borderWidth: 2, pointRadius: 0, borderDash: [2, 4] }
    ] },
    options: { scales: { y: { beginAtZero: true, grid: { color: '#1b2d5f' } }, x: { grid: { display: false } } }, interaction: { mode: 'index', intersect: false } }
  });
}
function oppInfo(code) {
  const st = standings(), o = st.find(s => s.code === code);
  if (!o) return '';
  return `<span class="pill">${esc(team(code).short)}: ${o.pos}º · ${o.pts} pts</span><span class="pill">Forma ${o.form.slice(-5).map(r => ({ W: 'V', D: 'E', L: 'D' }[r])).join('')}</span>`;
}

/* ---------- TEMPORADA ---------- */
function rTemporada() {
  const st = standings(), ms = zarMatches(), n = lastRound();
  const P = S.season.promotion;
  const zone = p => p <= P.direct ? 'z1' : (p >= P.playoff[0] && p <= P.playoff[1]) ? 'z2' : p >= P.relegation[0] ? 'z3' : 'z0';
  $('#view-temporada').innerHTML = `
  <div class="section-title"><h2>Clasificación</h2><small>Grupo 2 · desempate por diferencia de goles (sin enfrentamiento directo)</small></div>
  <div class="card"><div class="table-wrap"><table>
    <thead><tr><th>#</th><th style="text-align:left">Equipo</th><th>PJ</th><th>V</th><th>E</th><th>D</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th><th>Forma</th></tr></thead>
    <tbody>${st.map(s => `<tr class="${s.code === S.season.team ? 'me' : ''}"><td><span class="zone ${zone(s.pos)}"></span>${s.pos}</td><td class="t">${esc(team(s.code).short)}</td><td>${s.pj}</td><td>${s.w}</td><td>${s.d}</td><td>${s.l}</td><td>${s.gf}</td><td>${s.ga}</td><td>${s.gf - s.ga > 0 ? '+' : ''}${s.gf - s.ga}</td><td><b>${s.pts}</b></td><td><div class="form" style="gap:3px">${s.form.slice(-5).map(r => `<b class="${r}" style="width:16px;height:16px;font-size:9px;border-radius:4px">${{ W: 'V', D: 'E', L: 'D' }[r]}</b>`).join('')}</div></td></tr>`).join('')}</tbody>
  </table></div>
  <div class="legend"><span><i style="background:var(--win)"></i>Ascenso directo</span><span><i style="background:var(--blue2)"></i>Play-off</span><span><i style="background:var(--loss)"></i>Descenso</span></div></div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Evolución en la tabla</h3><div class="sub">Puesto tras cada jornada</div><div class="chart-wrap"><canvas id="cPos"></canvas></div></div>
    <div class="card"><h3>Carrera por el ascenso</h3><div class="sub">Puntos acumulados de los 5 primeros</div><div class="chart-wrap"><canvas id="cRace"></canvas></div><div class="legend" id="lgRace"></div></div>
    <div class="card"><h3>Goles por jornada</h3><div class="sub">A favor (arriba) y en contra (abajo)</div><div class="chart-wrap short"><canvas id="cGoals"></canvas></div></div>
    <div class="card"><h3>Casa vs fuera</h3><div class="sub">Puntos por partido y goles por partido</div><div class="chart-wrap short"><canvas id="cHA"></canvas></div></div>
  </div>

  <div class="section-title"><h2>Partidos</h2><small>${ms.filter(m => m.res).length} jugados · ${ms.filter(m => !m.res).length} pendientes</small></div>
  <div class="matches">${ms.map(m => `<div class="match"><div class="j">J${m.j}</div><div class="opp">${m.home ? 'vs' : 'en'} ${esc(team(m.opp).short)}<small>${m.home ? 'Ibercaja Estadio' : 'Fuera'} · ${dateES(m.date)}${S.user.actas[m.j] ? ' · 📝 acta' : ''}</small></div>${m.res ? `<div class="score ${m.res}">${m.home ? m.gf + '-' + m.ga : m.ga + '-' + m.gf}</div>` : '<div class="score pend">—</div>'}</div>`).join('')}</div>`;

  const pos = positionsByRound();
  chart('cPos', { type: 'line', data: { labels: jLabels(pos.length), datasets: [{ data: pos, borderColor: '#fff', backgroundColor: '#2f6bff33', fill: 'start', borderWidth: 3, pointRadius: 4, pointBackgroundColor: pos.map(p => p === 1 ? '#22c58b' : p <= 5 ? '#5b8cff' : '#ff5a6a'), tension: .3 }] },
    options: { scales: { y: { reverse: true, min: 1, max: 20, ticks: { stepSize: 1, callback: v => [1, 5, 10, 15, 20].includes(v) ? v + 'º' : '' }, grid: { color: '#1b2d5f' } }, x: { grid: { display: false } } } } });

  const top = st.slice(0, 5).map(s => s.code);
  if (!top.includes(S.season.team)) top.push(S.season.team);
  const pal = ['#ff5a5f', '#f5b83d', '#3ccf7a', '#a77bff', '#5fd0ff'];
  const ds = top.map((c, i) => {
    let a = 0; const arr = [];
    for (let j = 1; j <= n; j++) { const s = standings(j).find(x => x.code === c); arr.push(s.pts); }
    const me = c === S.season.team;
    return { label: team(c).short, data: arr, borderColor: me ? '#fff' : pal[i % pal.length], borderWidth: me ? 3.5 : 2, pointRadius: me ? 3 : 0, tension: .25 };
  });
  chart('cRace', { type: 'line', data: { labels: jLabels(n), datasets: ds }, options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: '#1b2d5f' } }, x: { grid: { display: false } } } } });
  $('#lgRace').innerHTML = ds.map(d => `<span><i style="background:${d.borderColor}"></i>${esc(d.label)}</span>`).join('');

  const pl = ms.filter(m => m.res);
  chart('cGoals', { type: 'bar', data: { labels: pl.map(m => 'J' + m.j), datasets: [
    { data: pl.map(m => m.gf), backgroundColor: '#22c58b', borderRadius: 4 }, { data: pl.map(m => -m.ga), backgroundColor: '#ff5a6a', borderRadius: 4 }] },
    options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: v => Math.abs(v) }, grid: { color: '#1b2d5f' } } }, plugins: { tooltip: { callbacks: { label: c => (c.datasetIndex ? 'En contra: ' : 'A favor: ') + Math.abs(c.raw) } } } } });

  const h = pl.filter(m => m.home), a = pl.filter(m => !m.home), avg = (arr, f) => arr.length ? arr.reduce((s, m) => s + f(m), 0) / arr.length : 0;
  chart('cHA', { type: 'bar', data: { labels: ['Pts/partido', 'Goles a favor', 'Goles en contra'], datasets: [
    { label: 'Casa', data: [avg(h, m => m.pts), avg(h, m => m.gf), avg(h, m => m.ga)].map(v => +v.toFixed(2)), backgroundColor: '#ffffff', borderRadius: 6 },
    { label: 'Fuera', data: [avg(a, m => m.pts), avg(a, m => m.gf), avg(a, m => m.ga)].map(v => +v.toFixed(2)), backgroundColor: '#2f6bff', borderRadius: 6 }] },
    options: { plugins: { legend: { display: true, labels: { boxWidth: 12 } } }, scales: { y: { beginAtZero: true, grid: { color: '#1b2d5f' } }, x: { grid: { display: false } } } } });
}

/* ---------- CAMPEONES ---------- */
function champSet() {
  const all = S.history.seasons;
  return S.champMode === 'last4' ? all.filter(s => s.season === '25/26' || s.season === '24/25') : all;
}
function rCampeones() {
  const cum = zarCumulative(), n = cum.length, pts = cum[n - 1] || 0, ppg = n ? pts / n : 0;
  const cs = champSet();
  $('#view-campeones').innerHTML = `
  <div class="section-title"><h2>Real Zaragoza vs últimos campeones</h2>
    <div class="seg"><button data-m="last4" class="${S.champMode === 'last4' ? 'on' : ''}">Últimos 4</button><button data-m="all" class="${S.champMode === 'all' ? 'on' : ''}">Últimos 8</button></div></div>
  <div class="champs">
    <div class="ccard zar"><div class="rank">1</div>
      <div class="head"><div class="chip" style="background:#1747c9">RZ</div><div><div class="name">Real Zaragoza</div><div class="meta">26/27 · Grupo 2</div></div></div>
      <div class="cols"><div><div class="colh">DATOS</div><div class="big"><small>J${n}:</small>${pts}</div><div class="unit">PUNTOS</div></div><div class="sep"></div>
      <div><div class="colh">FINAL LIGA</div><div class="proj">PROYECCIÓN</div><div class="big" style="color:#1747c9">${fmt(ppg * 38, 1)}</div><div class="unit">PUNTOS</div></div></div>
      <div class="foot">MEDIA PARTIDO (J${n}): <b style="color:#1747c9">${fmt(ppg, 2)}</b> PUNTOS</div></div>
    ${cs.map((c, i) => { const col = CHAMP_COLORS[c.champion] || '#999', atN = c.curve[Math.max(0, n - 1)]; const diff = pts - atN; return `
    <div class="ccard"><div class="rank">${i + 2}</div>
      <div class="head"><div class="chip" style="background:${col}">${CHAMP_ABBR[c.champion] || ''}</div><div><div class="name">${esc(c.champion)}</div><div class="meta">${c.season} · Grupo ${c.group} · ${c.record.w}V ${c.record.d}E ${c.record.l}D</div></div></div>
      <div class="cols"><div><div class="colh">DATOS</div><div class="big" style="color:${diff > 0 ? '#c0392b' : '#0a1430'}"><small>J${n}:</small>${atN}</div><div class="unit">PUNTOS · <span style="color:${diff >= 0 ? '#16a36f' : '#c0392b'}">RZ ${diff >= 0 ? '+' : ''}${diff}</span></div></div><div class="sep"></div>
      <div><div class="colh">FINAL LIGA</div><div class="big">${c.points}</div><div class="unit">PUNTOS</div></div></div>
      <div class="foot">MEDIA PARTIDO (LIGA): <b style="color:${col}">${fmt(c.points / 38, 2)}</b> PUNTOS</div></div>`; }).join('')}
  </div>

  <div class="card" style="margin-top:14px"><h3>Puntos acumulados por jornada</h3><div class="sub">Toca la leyenda para ocultar o mostrar equipos</div>
    <div class="chart-wrap tall"><canvas id="cChamps"></canvas></div><div class="legend" id="lgChamps"></div></div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Diferencia con cada campeón</h3><div class="sub">Puntos del Zaragoza menos los del campeón en la misma jornada (J${n})</div><div class="chart-wrap"><canvas id="cDiff"></canvas></div></div>
    <div class="card"><h3>Dónde estaría el Zaragoza</h3><div class="sub">Media de 22/23-24/25 (6 grupos) de los puntos del 1º, 2º, 5º y 15º en cada jornada</div><div class="chart-wrap"><canvas id="cBands"></canvas></div>
      <div class="legend"><span><i style="background:#fff"></i>Zaragoza</span><span><i style="background:#22c58b"></i>1º</span><span><i style="background:#f2c14e"></i>2º</span><span><i style="background:#5b8cff"></i>5º (play-off)</span><span><i style="background:#ff5a6a"></i>15º (salvación)</span></div></div>
  </div>

  <div class="card" style="margin-top:14px"><h3>Ficha de los campeones</h3><div class="table-wrap"><table>
    <thead><tr><th style="text-align:left">Campeón</th><th>Temp.</th><th>Gr.</th><th>J${n}</th><th>J19</th><th>Final</th><th>Pts/P</th><th>GF</th><th>GC</th><th>2º</th></tr></thead>
    <tbody>${S.history.seasons.map(c => `<tr><td class="t"><span class="zone" style="background:${CHAMP_COLORS[c.champion]}"></span>${esc(c.champion)}</td><td>${c.season}</td><td>${c.group}</td><td>${c.curve[Math.max(0, n - 1)]}</td><td>${c.curve[18]}</td><td><b>${c.points}</b></td><td>${fmt(c.points / 38, 2)}</td><td>${c.record.gf}</td><td>${c.record.ga}</td><td>${c.final.second}</td></tr>`).join('')}
    <tr class="me"><td class="t">Real Zaragoza</td><td>26/27</td><td>2</td><td>${pts}</td><td>${cum[18] ?? '–'}</td><td>${fmt(ppg * 38, 1)}*</td><td>${fmt(ppg, 2)}</td><td colspan="3" class="muted">* proyección</td></tr></tbody></table></div>
    <p class="muted small" style="margin-top:8px">Tenerife 25/26: 76 puntos según la clasificación oficial (22V 10E 6D). Algunas infografías lo dan con 74.</p></div>`;

  $$('#view-campeones .seg button').forEach(b => b.onclick = () => { S.champMode = b.dataset.m; rCampeones(); });

  const ds = [{ label: 'Real Zaragoza', data: cum, borderColor: '#fff', borderWidth: 4, pointRadius: 3, pointBackgroundColor: '#fff', tension: .25, order: 0 }]
    .concat(cs.map(c => ({ label: `${CHAMP_ABBR[c.champion]} ${c.season.replace('/', '')}`, data: c.curve, borderColor: CHAMP_COLORS[c.champion], borderWidth: 2, pointRadius: 0, tension: .25 })));
  const ch = chart('cChamps', { type: 'line', data: { labels: jLabels(38), datasets: ds }, options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, max: 85, grid: { color: '#1b2d5f' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } } } } });
  $('#lgChamps').innerHTML = ds.map((d, i) => `<span data-i="${i}"><i style="background:${d.borderColor}"></i>${esc(d.label)}</span>`).join('');
  $$('#lgChamps span').forEach(sp => sp.onclick = () => { const i = +sp.dataset.i; const v = ch.isDatasetVisible(i); ch.setDatasetVisibility(i, !v); ch.update(); sp.classList.toggle('off', v); });

  const all = S.history.seasons;
  chart('cDiff', { type: 'bar', data: { labels: all.map(c => `${CHAMP_ABBR[c.champion]} ${c.season}`), datasets: [{ data: all.map(c => pts - c.curve[Math.max(0, n - 1)]), backgroundColor: all.map(c => (pts - c.curve[Math.max(0, n - 1)]) >= 0 ? '#22c58b' : '#ff5a6a'), borderRadius: 6 }] },
    options: { indexAxis: 'y', scales: { x: { grid: { color: '#1b2d5f' } }, y: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: c => (c.raw >= 0 ? '+' : '') + c.raw + ' pts' } } } } });

  const withB = all.filter(c => c.bands), band = k => Array.from({ length: 38 }, (_, i) => +(withB.reduce((s, c) => s + c.bands[k][i], 0) / withB.length).toFixed(1));
  chart('cBands', { type: 'line', data: { labels: jLabels(38), datasets: [
    { data: cum, borderColor: '#fff', borderWidth: 3.5, pointRadius: 2, tension: .25 },
    { data: band('p1'), borderColor: '#22c58b', borderWidth: 2, pointRadius: 0, tension: .25 },
    { data: band('p2'), borderColor: '#f2c14e', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 4] },
    { data: band('p5'), borderColor: '#5b8cff', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [5, 4] },
    { data: band('p15'), borderColor: '#ff5a6a', borderWidth: 2, pointRadius: 0, tension: .25, borderDash: [2, 4] }] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: '#1b2d5f' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } } } } });
}

/* ---------- MICROOBJETIVOS ---------- */
function microBlocks() {
  const M = S.season.micro, ms = zarMatches(), blocks = [];
  let j = 1, i = 1;
  while (j <= 38) {
    const size = (38 - j + 1) <= M.lastBlock.size ? M.lastBlock.size : M.size;
    const target = size === M.size ? M.target : M.lastBlock.target;
    const games = ms.filter(m => m.j >= j && m.j < j + size);
    const played = games.filter(m => m.res), pts = played.reduce((s, m) => s + m.pts, 0);
    const maxPossible = pts + (games.length - played.length) * 3;
    const status = played.length === games.length ? (pts >= target ? 'ok' : 'ko') : played.length ? 'live' : (maxPossible < target ? 'ko' : 'pending');
    blocks.push({ i, from: j, to: j + size - 1, size, target, games, played: played.length, pts, status, need: Math.max(0, target - pts) });
    j += size; i++;
  }
  // si ningún bloque está en curso, marcamos el siguiente pendiente como "live" para el inicio
  if (!blocks.some(b => b.status === 'live')) { const nx = blocks.find(b => b.status === 'pending'); if (nx) nx.status = 'live'; }
  return blocks;
}
function blockCard(b, compact = false) {
  const pct = Math.min(100, b.pts / (b.size * 3) * 100), tg = b.target / (b.size * 3) * 100;
  const label = b.status === 'ok' ? '✅ Cumplido' : b.status === 'ko' ? '❌ No cumplido' : b.status === 'live' ? (b.need ? `⏳ En juego · faltan ${b.need} pts` : `✅ Objetivo ya alcanzado · ${b.size - b.played} partido${b.size - b.played > 1 ? 's' : ''} por jugar`) : 'Pendiente';
  return `<div class="bh"><h3>Bloque ${b.i} <small class="muted" style="font-family:Inter;font-size:12px">J${b.from}-J${b.to}</small></h3><div class="pts">${b.pts}<small>/${b.target}</small></div></div>
  <div class="bar"><i style="width:${pct}%"></i><span class="tgt" style="left:${tg}%"></span></div>
  <div class="row" style="justify-content:space-between;margin-top:8px"><span class="small">${label}</span><span class="small muted">${b.pts - b.target >= 0 && b.played === b.size ? '+' + (b.pts - b.target) + ' de superávit' : ''}</span></div>
  ${compact ? '' : ''}
  <div class="mini">${b.games.map(m => `<div class="${m.res || ''}"><b>${m.res ? (m.home ? m.gf + '-' + m.ga : m.ga + '-' + m.gf) : '·'}</b>${m.home ? '' : '@'}${esc(team(m.opp).code)}</div>`).join('')}</div>`;
}
function rMicro() {
  const B = microBlocks(), done = B.filter(b => b.status === 'ok' || b.status === 'ko');
  const ok = B.filter(b => b.status === 'ok').length;
  const cum = zarCumulative(), n = cum.length, pts = cum[n - 1] || 0;
  const target = j => { let t = 0; B.forEach(b => { const k = Math.max(0, Math.min(j, b.to) - b.from + 1); if (k > 0) t += b.target * (k / b.size); }); return +t.toFixed(2); };
  const targetBlocks = Array.from({ length: 38 }, (_, i) => { const b = B.find(x => i + 1 >= x.from && i + 1 <= x.to); return (i + 1 === b.to) ? B.filter(x => x.to <= i + 1).reduce((s, x) => s + x.target, 0) : null; });
  const sup = pts - target(n);
  $('#view-micro').innerHTML = `
  <div class="section-title"><h2>Microobjetivos de Ibai</h2><small>Bloques de 4 partidos · mínimo 7 puntos</small></div>
  <div class="note">El método que explicó Ibai Gómez: dividir la liga en bloques de cuatro jornadas y sumar al menos <b>7 puntos</b> en cada uno. Son 9 bloques de 4 partidos más un último bloque de 2 (objetivo 6), lo que da <b>69 puntos</b> si se cumplen todos.</div>
  <div class="grid g4" style="margin-top:14px">
    <div class="card kpi"><span class="k">Superávit acumulado</span><span class="v ${sup >= 0 ? 'up' : 'down'}">${sup >= 0 ? '+' : ''}${fmt(sup, 1)}</span><span class="d">${pts} pts frente a ${fmt(target(n), 1)} del plan (J${n})</span></div>
    <div class="card kpi"><span class="k">Bloques cumplidos</span><span class="v">${ok}/${done.length}</span><span class="d">de los cerrados</span></div>
    <div class="card kpi"><span class="k">Proyección al ritmo actual</span><span class="v">${fmt(pts / Math.max(1, n) * 38, 1)}</span><span class="d">vs 69 del plan</span></div>
    <div class="card kpi"><span class="k">Para llegar a 69</span><span class="v">${Math.max(0, 69 - pts)}</span><span class="d">pts en ${38 - n} partidos: ${fmt(Math.max(0, 69 - pts) / Math.max(1, 38 - n), 2)} por partido</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Plan vs realidad</h3><div class="sub">Puntos acumulados del Zaragoza frente al objetivo de cada bloque</div>
    <div class="chart-wrap"><canvas id="cMicro"></canvas></div>
    <div class="legend"><span><i style="background:#fff"></i>Zaragoza</span><span><i style="background:#5b8cff"></i>Plan (7 cada 4)</span><span><i style="background:#22c58b"></i>Superávit por bloque</span></div></div>
  <div class="blocks" style="margin-top:14px">${B.map(b => `<div class="block ${b.status === 'ok' ? 'ok' : b.status === 'ko' ? 'ko' : b.status === 'live' ? 'live' : ''}">${blockCard(b)}</div>`).join('')}</div>`;

  chart('cMicro', { data: { labels: jLabels(38), datasets: [
    { type: 'line', data: cum, borderColor: '#fff', borderWidth: 3.5, pointRadius: 3, tension: .2, order: 0 },
    { type: 'line', data: Array.from({ length: 38 }, (_, i) => target(i + 1)), borderColor: '#5b8cff', borderWidth: 2, borderDash: [6, 4], pointRadius: targetBlocks.map(v => v ? 4 : 0), pointBackgroundColor: '#5b8cff', tension: 0, order: 1 },
    { type: 'bar', data: Array.from({ length: 38 }, (_, i) => { const b = B.find(x => x.to === i + 1 && x.played === x.size); return b ? b.pts - b.target : null; }), backgroundColor: c => (c.raw ?? 0) >= 0 ? '#22c58b' : '#ff5a6a', borderRadius: 4, order: 2 }] },
    options: { interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, grid: { color: '#1b2d5f' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } } } } });
}

/* ---------- PLANTILLA ---------- */
function rPlantilla() {
  let P = playerTotals();
  const nPlayed = lastRound(), maxMin = nPlayed * 90;
  const keys = { min: 'Minutos', g: 'Goles', a: 'Asistencias', ga: 'G+A', pj: 'Partidos', pt: 'Titular' };
  const list = P.filter(p => S.posFilter === 'ALL' || p.pos === S.posFilter).sort((a, b) => (b[S.sortBy] - a[S.sortBy]) || b.min - a.min);
  const totG = P.reduce((s, p) => s + p.g, 0);
  $('#view-plantilla').innerHTML = `
  <div class="section-title"><h2>Plantilla</h2><small>${P.length} jugadores · ${maxMin}' disputados</small></div>
  <div class="toolbar">
    <div class="seg" id="segPos">${['ALL', 'POR', 'DEF', 'MED', 'DEL'].map(k => `<button data-k="${k}" class="${S.posFilter === k ? 'on' : ''}">${k === 'ALL' ? 'Todos' : k}</button>`).join('')}</div>
    <select id="selSort" style="width:auto">${Object.entries(keys).map(([k, v]) => `<option value="${k}" ${S.sortBy === k ? 'selected' : ''}>Ordenar: ${v}</option>`).join('')}</select>
    <button class="btn ${S.cmpMode ? 'primary' : 'ghost'}" id="btnCmp">${S.cmpMode ? `Elige 2 jugadores (${S.compare.length}/2)` : S.compare.length === 2 ? 'Quitar comparación' : '⚖️ Comparar'}</button>
  </div>
  <div class="players">${list.map(p => `
    <div class="pcard ${S.compare.includes(p.name) ? 'sel' : ''}" data-name="${esc(p.name)}">
      <div class="num">${p.n ?? ''}</div>
      <div class="avatar pos-${p.pos}" ${p.photo ? `style="background-image:url('${esc(p.photo)}')"` : ''}>${p.photo ? '' : initials(p.name)}</div>
      <div class="pn">${esc(p.name)}</div><div class="pp">${POS_NAME[p.pos]}${p.n ? ' · #' + p.n : ''}</div>
      <div class="pstats"><div><b>${p.min}'</b><span>Min</span></div><div><b>${p.g}</b><span>Goles</span></div><div><b>${p.a}</b><span>Asist</span></div></div>
      <div class="minbar" title="${Math.round(p.min / maxMin * 100)}% de los minutos"><i style="width:${Math.min(100, p.min / maxMin * 100)}%"></i></div>
    </div>`).join('')}</div>

  <div id="cmpBox"></div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card span2"><h3>Reparto de minutos</h3><div class="sub">% de los ${maxMin} minutos posibles · color por demarcación</div><div class="chart-wrap tall"><canvas id="cMins"></canvas></div></div>
    <div class="card"><h3>Participación en goles</h3><div class="sub">Goles + asistencias (${totG} goles de jugadores)</div><div class="chart-wrap"><canvas id="cGA"></canvas></div></div>
    <div class="card"><h3>Eficiencia</h3><div class="sub">Minutos jugados vs goles+asistencias por 90'</div><div class="chart-wrap"><canvas id="cEff"></canvas></div></div>
  </div>
  <p class="footer-src">Base hasta la J${S.season.baseRound}: AupaZaragoza.com. Desde la J${S.season.baseRound + 1}, se suma lo que registres en el Acta. ${P.hasCards ? '' : 'Las tarjetas por jugador aparecerán a medida que registres actas.'}</p>`;

  $$('#segPos button').forEach(b => b.onclick = () => { S.posFilter = b.dataset.k; rPlantilla(); });
  $('#selSort').onchange = e => { S.sortBy = e.target.value; rPlantilla(); };
  $('#btnCmp').onclick = () => {
    if (S.cmpMode || S.compare.length === 2) { S.cmpMode = false; S.compare = []; }
    else { S.cmpMode = true; S.compare = []; toast('Toca dos jugadores para compararlos'); }
    rPlantilla();
  };
  $$('.pcard').forEach(c => c.onclick = () => {
    const nm = c.dataset.name;
    if (S.cmpMode) {
      S.compare = S.compare.includes(nm) ? S.compare.filter(x => x !== nm) : S.compare.concat(nm).slice(-2);
      if (S.compare.length === 2) S.cmpMode = false;
      rPlantilla(); if (S.compare.length === 2) $('#cmpBox').scrollIntoView({ behavior: 'smooth' });
    } else playerDialog(nm);
  });
  if (S.compare.length === 2) renderCompare(P);

  const PC = { POR: '#d18b1f', DEF: '#1f8a5f', MED: '#2f6bff', DEL: '#c8364b' };
  const bym = [...P].filter(p => p.min > 0).sort((a, b) => b.min - a.min);
  chart('cMins', { type: 'bar', data: { labels: bym.map(p => p.name), datasets: [{ data: bym.map(p => +(p.min / maxMin * 100).toFixed(1)), backgroundColor: bym.map(p => PC[p.pos]), borderRadius: 5 }] },
    options: { indexAxis: 'y', scales: { x: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#1b2d5f' } }, y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10.5 } } } }, plugins: { tooltip: { callbacks: { label: c => `${bym[c.dataIndex].min}' (${c.raw}%)` } } } } });
  const byg = [...P].filter(p => p.ga > 0).sort((a, b) => b.ga - a.ga || b.g - a.g);
  chart('cGA', { type: 'bar', data: { labels: byg.map(p => p.name.split(' ').slice(-1)[0]), datasets: [{ label: 'Goles', data: byg.map(p => p.g), backgroundColor: '#ffffff', borderRadius: 4 }, { label: 'Asistencias', data: byg.map(p => p.a), backgroundColor: '#2f6bff', borderRadius: 4 }] },
    options: { plugins: { legend: { display: true, labels: { boxWidth: 12 } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { stepSize: 1 }, grid: { color: '#1b2d5f' } } } } });
  const eff = P.filter(p => p.min >= 90 && p.pos !== 'POR');
  chart('cEff', { type: 'scatter', data: { datasets: [{ data: eff.map(p => ({ x: p.min, y: +((p.g + p.a) / p.min * 90).toFixed(2), n: p.name })), backgroundColor: eff.map(p => PC[p.pos]), pointRadius: 7, pointHoverRadius: 9 }] },
    options: { scales: { x: { title: { display: true, text: 'Minutos' }, grid: { color: '#1b2d5f' } }, y: { title: { display: true, text: 'G+A por 90\'' }, beginAtZero: true, grid: { color: '#1b2d5f' } } }, plugins: { tooltip: { callbacks: { label: c => `${c.raw.n}: ${c.raw.x}' · ${fmt(c.raw.y, 2)} G+A/90` } } } } });
}
function renderCompare(P) {
  const [a, b] = S.compare.map(n => P.find(p => p.name === n));
  if (!a || !b) return;
  const per90 = (p, k) => p.min ? p[k] / p.min * 90 : 0;
  const metrics = [['Minutos', p => p.min], ['Partidos', p => p.pj], ['Titular', p => p.pt], ['Goles', p => p.g], ['Asist.', p => p.a], ['G+A/90', p => +(per90(p, 'ga')).toFixed(2)]];
  $('#cmpBox').innerHTML = `<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between"><h3>Cara a cara</h3><button class="btn ghost" id="cmpX">Cerrar</button></div>
  <div class="grid g2"><div class="chart-wrap"><canvas id="cCmp"></canvas></div>
  <div class="table-wrap"><table><thead><tr><th></th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${metrics.map(([k, f]) => { const va = f(a), vb = f(b); return `<tr><td class="t">${k}</td><td style="${va > vb ? 'color:#fff;font-weight:800' : ''}">${va}</td><td style="${vb > va ? 'color:#f2c14e;font-weight:800' : ''}">${vb}</td></tr>`; }).join('')}</tbody></table></div></div></div>`;
  $('#cmpX').onclick = () => { S.compare = []; rPlantilla(); };
  const mx = metrics.map(([, f]) => Math.max(f(a), f(b), 0.0001));
  chart('cCmp', { type: 'radar', data: { labels: metrics.map(m => m[0]), datasets: [
    { label: a.name, data: metrics.map(([, f], i) => +(f(a) / mx[i] * 100).toFixed(0)), borderColor: '#fff', backgroundColor: '#ffffff33', borderWidth: 2 },
    { label: b.name, data: metrics.map(([, f], i) => +(f(b) / mx[i] * 100).toFixed(0)), borderColor: '#f2c14e', backgroundColor: '#f2c14e33', borderWidth: 2 }] },
    options: { plugins: { legend: { display: true } }, scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: '#22366a' }, angleLines: { color: '#22366a' }, pointLabels: { color: '#a9b8de' } } } } });
}
function playerDialog(name) {
  const P = playerTotals(), p = P.find(x => x.name === name), maxMin = lastRound() * 90;
  const dlg = $('#dlg');
  dlg.innerHTML = `<div class="dlg-body">
    <div class="dlg-head"><div class="row"><div class="avatar pos-${p.pos}" style="width:56px;height:56px;margin:0;${p.photo ? `background-image:url('${esc(p.photo)}')` : ''}">${p.photo ? '' : initials(p.name)}</div><div><h2 style="font-size:28px">${esc(p.name)}</h2><div class="muted small">${POS_NAME[p.pos]}${p.n ? ' · dorsal ' + p.n : ''}</div></div></div><button class="x" onclick="this.closest('dialog').close()">✕</button></div>
    <div class="grid g4">
      <div class="card kpi"><span class="k">Minutos</span><span class="v">${p.min}</span><span class="d">${Math.round(p.min / Math.max(1, maxMin) * 100)}% del total</span></div>
      <div class="card kpi"><span class="k">Partidos</span><span class="v">${p.pj}</span><span class="d">${p.pt} de titular</span></div>
      <div class="card kpi"><span class="k">Goles</span><span class="v">${p.g}</span><span class="d">${p.min ? fmt(p.g / p.min * 90, 2) : '–'} por 90'</span></div>
      <div class="card kpi"><span class="k">Asistencias</span><span class="v">${p.a}</span><span class="d">${p.min ? fmt(p.a / p.min * 90, 2) : '–'} por 90'</span></div>
    </div>
    ${p.log.length ? `<h3 style="margin-top:14px;font-size:20px">Partido a partido (actas)</h3><div class="chart-wrap short"><canvas id="cPlog"></canvas></div>` : `<p class="muted small" style="margin-top:14px">El detalle partido a partido aparecerá cuando registres actas.</p>`}
    <label style="margin-top:14px">URL de foto (opcional)<input id="photoUrl" placeholder="https://…" value="${esc(p.photo || '')}"></label>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn primary" id="savePhoto">Guardar foto</button></div>
  </div>`;
  dlg.showModal();
  $('#savePhoto').onclick = () => { const v = $('#photoUrl').value.trim(); if (v) S.user.photos[name] = v; else delete S.user.photos[name]; saveUser(); dlg.close(); rPlantilla(); toast('Foto guardada'); };
  if (p.log.length) {
    const L = p.log.sort((a, b) => a.j - b.j);
    chart('cPlog', { type: 'bar', data: { labels: L.map(x => 'J' + x.j), datasets: [{ data: L.map(x => x.min), backgroundColor: L.map(x => x.start ? '#ffffff' : '#5b8cff'), borderRadius: 5 }] },
      options: { scales: { y: { max: 95, grid: { color: '#1b2d5f' } }, x: { grid: { display: false } } }, plugins: { tooltip: { callbacks: { label: c => { const x = L[c.dataIndex]; return `${x.min}' ${x.start ? '(titular)' : '(suplente)'}${x.g ? ' · ⚽' + x.g : ''}${x.a ? ' · 🅰️' + x.a : ''}`; } } } } } });
  }
}

/* ---------- ACTA RÁPIDA ---------- */
function rActa() {
  const ms = zarMatches();
  const def = S.actaJ || (ms.find(m => m.res && m.j > S.season.baseRound && !S.user.actas[m.j]) || ms.find(m => !m.res) || ms[ms.length - 1]).j;
  S.actaJ = def;
  const m = ms.find(x => x.j === def);
  const a = S.user.actas[def] || { starters: [], subs: [], goals: [], cards: [], stats: {}, len: 90 };
  const names = S.season.players.map(p => p.name);
  const opt = (sel, extra = '') => `<option value="">${extra || '—'}</option>` + names.map(n => `<option ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const stat = (k, lbl) => `<label>${lbl}<div class="row" style="flex-wrap:nowrap"><input type="number" step="any" data-stat="${k}.z" placeholder="RZ" value="${a.stats?.[k]?.z ?? ''}"><input type="number" step="any" data-stat="${k}.o" placeholder="Rival" value="${a.stats?.[k]?.o ?? ''}"></div></label>`;
  $('#view-acta').innerHTML = `
  <div class="section-title"><h2>Acta rápida</h2><small>Unos 3 minutos por partido</small></div>
  <div class="card">
    <div class="form-grid">
      <label>Jornada<select id="aJ">${ms.map(x => `<option value="${x.j}" ${x.j === def ? 'selected' : ''}>J${x.j} · ${x.home ? 'vs' : 'en'} ${esc(team(x.opp).short)}${S.user.actas[x.j] ? ' ✓' : ''}</option>`).join('')}</select></label>
      <label>Duración (min)<input id="aLen" type="number" value="${a.len || 90}"></label>
      <label>Goles Zaragoza<input id="aGF" type="number" min="0" value="${m.gf ?? ''}"></label>
      <label>Goles ${esc(team(m.opp).short)}<input id="aGA" type="number" min="0" value="${m.ga ?? ''}"></label>
    </div>
    <h3 style="margin-top:16px">Once inicial <small class="muted" id="cnt11" style="font-family:Inter;font-size:12px"></small></h3>
    <div class="chips" id="aStart">${S.season.players.map(p => `<button class="chip-toggle ${a.starters.includes(p.name) ? 'on' : ''}" data-n="${esc(p.name)}">${p.n ?? ''} ${esc(p.name)}</button>`).join('')}</div>

    <h3 style="margin-top:16px">Cambios</h3>
    <div id="aSubs">${(a.subs.length ? a.subs : [{}]).map(s => `<div class="ev"><select data-f="out">${opt(s.out, 'Sale')}</select><select data-f="in">${opt(s.in, 'Entra')}</select><input data-f="min" type="number" placeholder="Min" value="${s.min ?? ''}"><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="subs">+ Cambio</button>

    <h3 style="margin-top:16px">Goles del Zaragoza</h3>
    <div id="aGoals">${(a.goals.length ? a.goals : [{}]).map(g => `<div class="ev goal"><select data-f="player">${opt(g.player, 'Goleador')}</select><select data-f="assist">${opt(g.assist, 'Asistencia')}</select><input data-f="min" type="number" placeholder="Min" value="${g.min ?? ''}"><select data-f="kind"><option value="">Normal</option><option value="pen" ${g.pen ? 'selected' : ''}>Penalti</option><option value="og" ${g.og ? 'selected' : ''}>En propia</option></select><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="goals">+ Gol</button>

    <h3 style="margin-top:16px">Tarjetas</h3>
    <div id="aCards">${(a.cards.length ? a.cards : [{}]).map(c => `<div class="ev"><select data-f="player">${opt(c.player, 'Jugador')}</select><select data-f="type"><option value="Y" ${c.type === 'Y' ? 'selected' : ''}>🟨 Amarilla</option><option value="YR" ${c.type === 'YR' ? 'selected' : ''}>🟨🟥 Doble amarilla</option><option value="R" ${c.type === 'R' ? 'selected' : ''}>🟥 Roja directa</option></select><input data-f="min" type="number" placeholder="Min" value="${c.min ?? ''}"><button class="btn ghost" data-del>✕</button></div>`).join('')}</div>
    <button class="btn" data-add="cards">+ Tarjeta</button>

    <h3 style="margin-top:16px">Estadísticas del partido <small class="muted" style="font-family:Inter;font-size:12px">(opcional · Match Center de realzaragoza.com o AupaZaragoza)</small></h3>
    <div class="form-grid">${stat('xg', 'xG')}${stat('pos', 'Posesión %')}${stat('shots', 'Tiros')}${stat('sot', 'Tiros a puerta')}${stat('corners', 'Córners')}${stat('fouls', 'Faltas')}${stat('tackles', 'Entradas')}${stat('big', 'Ocasiones claras')}</div>

    <div class="row" style="justify-content:space-between;margin-top:18px">
      ${S.user.actas[def] ? '<button class="btn danger" id="aDel">Borrar acta</button>' : '<span></span>'}
      <button class="btn primary" id="aSave">Guardar acta</button>
    </div>
    ${def <= S.season.baseRound ? `<p class="note" style="margin-top:12px">Las jornadas 1-${S.season.baseRound} ya están incluidas en los totales de la plantilla. Un acta aquí sirve para el detalle partido a partido, pero no se vuelve a sumar.</p>` : ''}
  </div>
  ${settingsCard()}`;

  const upd11 = () => { const k = $$('#aStart .on').length; $('#cnt11').textContent = `${k}/11`; $('#cnt11').style.color = k === 11 ? 'var(--win)' : 'var(--ink3)'; };
  upd11();
  $('#aJ').onchange = e => { S.actaJ = +e.target.value; rActa(); };
  $$('#aStart .chip-toggle').forEach(b => b.onclick = () => { b.classList.toggle('on'); upd11(); });
  $$('[data-add]').forEach(b => b.onclick = () => {
    const box = { subs: '#aSubs', goals: '#aGoals', cards: '#aCards' }[b.dataset.add];
    const first = $(box).firstElementChild.cloneNode(true);
    $$('select,input', first).forEach(i => i.value = ''); $(box).appendChild(first); bindDel();
  });
  const bindDel = () => $$('[data-del]').forEach(b => b.onclick = () => { const row = b.closest('.ev'); if (row.parentElement.children.length > 1) row.remove(); else $$('select,input', row).forEach(i => i.value = ''); });
  bindDel();
  $('#aSave').onclick = () => saveActa(m);
  if ($('#aDel')) $('#aDel').onclick = () => { if (!confirmInline('aDel')) return; delete S.user.actas[def]; saveUser(); toast('Acta borrada'); rActa(); };
  bindSettings();
}
function confirmInline(id) { const b = $('#' + id); if (b.dataset.sure) return true; b.dataset.sure = 1; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Borrar acta'; }, 3000); return false; }
function rows(sel, fields) { return $$(sel + ' .ev').map(r => { const o = {}; fields.forEach(f => { const el = $(`[data-f="${f}"]`, r); o[f] = el ? el.value : ''; }); return o; }); }
function saveActa(m) {
  const gf = $('#aGF').value, ga = $('#aGA').value;
  const starters = $$('#aStart .on').map(b => b.dataset.n);
  const subs = rows('#aSubs', ['out', 'in', 'min']).filter(s => s.out && s.min !== '').map(s => ({ out: s.out, in: s.in || null, min: +s.min }));
  const goals = rows('#aGoals', ['player', 'assist', 'min', 'kind']).filter(g => g.player || g.kind === 'og').map(g => ({ player: g.player || null, assist: g.assist || null, min: g.min === '' ? null : +g.min, pen: g.kind === 'pen', og: g.kind === 'og' }));
  const cards = rows('#aCards', ['player', 'type', 'min']).filter(c => c.player).map(c => ({ player: c.player, type: c.type, min: c.min === '' ? null : +c.min }));
  const stats = {}; $$('[data-stat]').forEach(i => { if (i.value === '') return; const [k, s] = i.dataset.stat.split('.'); (stats[k] = stats[k] || {})[s] = +i.value; });
  if (starters.length && starters.length !== 11) { toast(`El once tiene ${starters.length} jugadores. Revisa antes de guardar.`); return; }
  if (gf !== '' && goals.length && goals.length !== +gf) toast(`Aviso: marcador ${gf} goles y ${goals.length} goles registrados`, 3500);
  S.user.actas[m.j] = { starters, subs, goals, cards, stats, len: +$('#aLen').value || 90, savedAt: new Date().toISOString() };
  if (gf !== '' && ga !== '') { const k = `${m.h}_${m.a}`; S.user.results[k] = m.home ? [+gf, +ga] : [+ga, +gf]; }
  saveUser(); toast('Acta de la J' + m.j + ' guardada ✓'); rActa();
}

/* ---------- ajustes, exportar, GitHub ---------- */
function settingsCard() {
  const c = S.cfg;
  return `<div class="card" style="margin-top:14px"><h3>Datos y sincronización</h3>
    <p class="muted small" style="margin-top:-4px">Tus actas se guardan en este dispositivo. Si configuras GitHub, también se guardan en el repositorio (archivo <code>data/user.json</code>) y las verás en cualquier dispositivo.</p>
    <div class="form-grid">
      <label>Repositorio (usuario/repo)<input id="cfgRepo" placeholder="usuario/real-zaragoza-stats" value="${esc(c.repo || '')}"></label>
      <label>Rama<input id="cfgBranch" placeholder="main" value="${esc(c.branch || 'main')}"></label>
      <label style="grid-column:1/-1">Token de GitHub (solo se guarda en este dispositivo)<input id="cfgToken" type="password" placeholder="github_pat_…" value="${esc(c.token || '')}"></label>
    </div>
    <div class="row" style="margin-top:10px"><button class="btn primary" id="cfgSave">Guardar ajustes</button><button class="btn" id="ghPush">Subir ahora</button><button class="btn" id="exp">Exportar JSON</button><label class="btn" style="flex-direction:row;text-transform:none;letter-spacing:0;font-size:13px;color:var(--ink)">Importar<input type="file" id="imp" accept="application/json" hidden></label></div>
    <p class="muted small" style="margin-top:10px">Token: GitHub → Settings → Developer settings → Fine-grained tokens → acceso solo a este repositorio con permiso <i>Contents: Read and write</i>.</p></div>`;
}
function bindSettings() {
  $('#cfgSave').onclick = () => { S.cfg = { repo: $('#cfgRepo').value.trim(), branch: $('#cfgBranch').value.trim() || 'main', token: $('#cfgToken').value.trim() }; lsSet(LS_CFG, S.cfg); toast('Ajustes guardados'); };
  $('#ghPush').onclick = () => ghSave().then(() => toast('Guardado en GitHub ✓')).catch(e => toast('Error GitHub: ' + e.message, 4000));
  $('#exp').onclick = () => { const b = new Blob([JSON.stringify(S.user, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'rz2627_user.json'; a.click(); };
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.actas) throw new Error('formato'); S.user = d; saveUser(false); toast('Datos importados'); renderAll(); } catch { toast('Archivo no válido'); } };
}
async function ghSave() {
  const { repo, token, branch = 'main' } = S.cfg; if (!repo || !token) throw new Error('falta configurar repo/token');
  const url = `https://api.github.com/repos/${repo}/contents/data/user.json`;
  const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
  let sha; const g = await fetch(url + '?ref=' + encodeURIComponent(branch), { headers: H }); if (g.ok) sha = (await g.json()).sha;
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(S.user, null, 1))));
  const r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify({ message: 'Actualizar datos ' + new Date().toISOString().slice(0, 16), content, sha, branch }) });
  if (!r.ok) throw new Error(r.status + ' ' + ((await r.json()).message || ''));
}

/* ---------- actualización desde Wikipedia ---------- */
const WIKI = {
  en: { page: '2026–27_Primera_Federación', module: /\{\{\s*#invoke:\s*sports results/i, match: /\|\s*match_([A-Z0-9]+)_([A-Z0-9]+)\s*=\s*([^\n|}]*)/g, key: 'en' },
  es: { page: 'Primera_Federación_2026-27', module: /\{\{\s*#invoke:\s*football results/i, match: /\|\s*partido_([A-Z0-9]+)_([A-Z0-9]+)\s*=\s*([^\n|}]*)/g, key: 'es' }
};
async function wikiResults(lang) {
  const W = WIKI[lang];
  const url = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(W.page)}&prop=wikitext&format=json&formatversion=2&origin=*`;
  const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status);
  const txt = (await r.json()).parse.wikitext;
  const parts = txt.split(W.module).slice(1).map(b => b.slice(0, b.search(/\n\}\}/) + 1 || undefined));
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
    const base = S.season.fixtures.find(f => `${f.h}_${f.a}` === k);
    if (!base) return;
    const actaLocked = S.user.actas[base.j] && (base.h === S.season.team || base.a === S.season.team);
    if (actaLocked && S.user.results[k]) return; // el acta manda en los partidos del Zaragoza
    if (base.hg === v[0] && base.ag === v[1]) { delete S.user.results[k]; } else S.user.results[k] = v;
    if (before.get(k) !== v[0] + '-' + v[1]) fresh.push(`${team(base.h).short} ${v[0]}-${v[1]} ${team(base.a).short}`);
  });
  S.user.wikiAt = new Date().toISOString();
  saveUser(fresh.length > 0);
  if (fresh.length) { toast(`${fresh.length} resultado${fresh.length > 1 ? 's' : ''} nuevo${fresh.length > 1 ? 's' : ''}: ${fresh.slice(0, 3).join(' · ')}${fresh.length > 3 ? '…' : ''}`, 4500); renderAll(); }
  else if (!silent) toast('Todo al día: no hay resultados nuevos en Wikipedia');
  return fresh;
}
async function updateAll() {
  const b = $('#btnUpdate'); b.classList.add('loading'); b.disabled = true;
  try {
    const remote = await loadJSON('data/user.json?t=' + Date.now(), true);
    if (remote && new Date(remote.updatedAt || 0) > new Date(S.user.updatedAt || 0)) { S.user = remote; lsSet(LS_USER, S.user); }
    await updateFromWikipedia();
  } catch (e) { toast('No se pudo actualizar: ' + e.message, 4000); }
  finally { b.classList.remove('loading'); b.disabled = false; renderAll(); }
}

boot().catch(e => { document.getElementById('app').innerHTML = `<div class="card"><h3>Error al cargar</h3><p class="muted">${esc(e.message)}</p></div>`; });
