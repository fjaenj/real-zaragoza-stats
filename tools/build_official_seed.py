# Corrige los lados de los eventos con las alineaciones (igual que el parser) y genera data/official.json
import json, sys, collections
src, dst = sys.argv[1], sys.argv[2]
o = json.load(open(src))
def fix(m):
    zar = {p['name'] for p in m['lineups']['zar']}; opp = {p['name'] for p in m['lineups']['opp']}
    side = lambda n, d: 'ZAR' if n in zar and n not in opp else 'OPP' if n in opp and n not in zar else d
    ev = []
    bymin = collections.defaultdict(list)
    for e in m['events']:
        if e['t'] == 'sub': bymin[e['min']].append(e)
        elif e['t'] == 'goal':
            s = side(e['player'], None)
            if s: e['side'] = ('OPP' if s == 'ZAR' else 'ZAR') if e['kind'] == 'og' else s
            ev.append(e)
        elif e['t'] in ('card', 'other'):
            e['side'] = side(e.get('player'), e['side']); ev.append(e)
        else: ev.append(e)
    for mn, subs in bymin.items():
        outs = [(s['out'], side(s['out'], s['side'])) for s in subs if s['out']]
        ins = [(s['in'], side(s['in'], s['side'])) for s in subs if s['in']]
        for sd in ('ZAR', 'OPP'):
            o_ = [n for n, s in outs if s == sd]; i_ = [n for n, s in ins if s == sd]
            for k in range(max(len(o_), len(i_))):
                ev.append({'t': 'sub', 'min': mn, 'side': sd, 'out': o_[k] if k < len(o_) else None, 'in': i_[k] if k < len(i_) else None})
    ev.sort(key=lambda e: e['min']); m['events'] = ev
    return m
out = {str(j): fix(m) for j, m in sorted(o.items(), key=lambda x: int(x[0]))}
json.dump({"updated": "2026-11-03T13:30:00Z", "source": "realzaragoza.com (fichas de partido)", "matches": out}, open(dst, 'w'), ensure_ascii=False, separators=(',', ':'))
# comprobación
mins = collections.Counter()
for m in out.values():
    on = {p['name']: (0 if p['start'] else None) for p in m['lineups']['zar']}; off = {}
    for e in m['events']:
        if e['side'] != 'ZAR': continue
        if e['t'] == 'sub':
            if e['out']: off[e['out']] = min(90, e['min'])
            if e['in']: on[e['in']] = min(90, e['min'])
        if e['t'] == 'card' and e['card'] in ('R', 'YR'): off[e['player']] = min(90, e['min'])
    for n, st in on.items():
        if st is not None: mins[n] += max(0, off.get(n, 90) - st)
print(sorted(mins.items(), key=lambda x: -x[1]))
