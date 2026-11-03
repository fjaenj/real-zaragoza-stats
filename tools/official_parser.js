// Convierte el JSON embebido (__NEXT_DATA__) de una ficha de partido de realzaragoza.com
// en un objeto compacto con alineaciones, eventos y estadísticas.
// Se usa desde tools/fetch_official.mjs (GitHub Actions) y puede pegarse en la consola del navegador.
function parseOfficial(nd) {
  const d = nd.props.pageProps.data, g = d.game;
  const isZar = t => /zaragoza/i.test((t && (t.name || t.shortName)) || '');
  const zarHome = isZar(g.homeTeam);
  const sideOf = t => (t && (t.id === g.homeTeam.id || t.name === g.homeTeam.name)) ? 'home' : 'away';
  const rel = s => (s === (zarHome ? 'home' : 'away')) ? 'ZAR' : 'OPP';
  const pname = p => p ? (p.nickname || p.name) : null;
  const lu = arr => (arr || []).filter(x => !x.manager && x.player).map(x => ({ n: x.shirtNumber, name: pname(x.player), start: !!x.starting, cap: !!x.captain, pos: x.formationPlace || null }));
  const evs = ((d.events && d.events.data) || []).slice().sort((a, b) => (a.minute - b.minute) || (new Date(a.date) - new Date(b.date)));
  const T = e => e.type && e.type.type, Q = e => e.qualificationType && e.qualificationType.name;
  // El feed oficial a veces etiqueta mal el equipo de un evento: manda la alineación en la que está el jugador.
  const zarNames = new Set(((zarHome ? d.lineups.homeTeam : d.lineups.awayTeam) || []).map(x => x.player && pname(x.player)));
  const oppNames = new Set(((zarHome ? d.lineups.awayTeam : d.lineups.homeTeam) || []).map(x => x.player && pname(x.player)));
  const pside = e => { const n = pname(e.relatedPlayer); if (zarNames.has(n) && !oppNames.has(n)) return 'ZAR'; if (oppNames.has(n) && !zarNames.has(n)) return 'OPP'; return rel(sideOf(e.team)); };
  const other = s => s === 'ZAR' ? 'OPP' : 'ZAR';
  const out = [];
  const offs = evs.filter(e => T(e) === 'PlayerOff'), ons = evs.filter(e => T(e) === 'PlayerOn'), used = new Set();
  offs.forEach(o => {
    const cands = ons.filter(x => !used.has(x.id) && pside(x) === pside(o) && x.minute === o.minute);
    const on = cands.sort((a, b) => Math.abs(new Date(a.date) - new Date(o.date)) - Math.abs(new Date(b.date) - new Date(o.date)))[0];
    if (on) used.add(on.id);
    out.push({ t: 'sub', min: o.minute, side: pside(o), out: pname(o.relatedPlayer), in: on ? pname(on.relatedPlayer) : null });
  });
  ons.filter(x => !used.has(x.id)).forEach(x => out.push({ t: 'sub', min: x.minute, side: pside(x), out: null, in: pname(x.relatedPlayer) }));
  evs.filter(e => T(e) === 'Goal').forEach(e => {
    const q = Q(e), s = pside(e);
    out.push({ t: 'goal', min: e.minute, side: q === 'Own' ? other(s) : s, player: pname(e.relatedPlayer), kind: q === 'Own' ? 'og' : q === 'Penalty' ? 'pen' : '', score: [e.homeScore, e.awayScore] });
  });
  evs.filter(e => T(e) === 'Card').forEach(e => {
    const q = Q(e) || '';
    out.push({ t: 'card', min: e.minute, side: pside(e), player: pname(e.relatedPlayer), card: /^yellow$/i.test(q) ? 'Y' : /second|2nd|yellowred|yellow.?red/i.test(q) ? 'YR' : 'R', q });
  });
  evs.filter(e => T(e) !== 'Goal' && T(e) !== 'Card' && !/Player(On|Off)|Period(Start|End)/.test(T(e))).forEach(e => out.push({ t: 'other', min: e.minute, side: pside(e), type: T(e), q: Q(e), player: pname(e.relatedPlayer) }));
  out.sort((a, b) => a.min - b.min);
  const st = x => (x && x.stats) ? x.stats : null;
  const S = d.stats || {};
  const finished = evs.some(e => T(e) === 'PeriodEnd' && Q(e) === 'FullTime') || /final|full/i.test((g.period && g.period.name) || '');
  const ref = (g.referees || []).map(r => (r.referee && (r.referee.name || r.referee.nickname)) || r.name || null).filter(Boolean);
  return {
    j: g.gameweek && g.gameweek.week, slug: g.slug, date: g.date, time: g.time,
    home: g.homeTeam.shortName || g.homeTeam.name, away: g.awayTeam.shortName || g.awayTeam.name, zarHome,
    hs: g.homeScore, as: g.awayScore, period: g.period && g.period.name, finished,
    venue: g.venue && g.venue.name, att: g.attendance, form: { home: g.homeFormation, away: g.awayFormation }, referee: ref[0] || null,
    shield: { home: g.homeTeam.shield || null, away: g.awayTeam.shield || null },
    lineups: { zar: lu(zarHome ? d.lineups.homeTeam : d.lineups.awayTeam), opp: lu(zarHome ? d.lineups.awayTeam : d.lineups.homeTeam) },
    events: out,
    stats: { zar: st(zarHome ? S.homeTeamStats : S.awayTeamStats), opp: st(zarHome ? S.awayTeamStats : S.homeTeamStats) }
  };
}
if (typeof module !== 'undefined') module.exports = { parseOfficial };
