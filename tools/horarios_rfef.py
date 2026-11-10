#!/usr/bin/env python3
"""Horarios de la jornada (Grupo 2 de 1ª Federación) y calendarios .ics.

1. Para las jornadas próximas, busca en rfef.es la noticia pública
   «Horarios y televisiones de la jornada N de Primera Federación» y su cartel del Grupo 2.
   El cartel es una imagen: se lee con OCR (tesseract) y cada fila se empareja con los
   partidos de esa jornada (que ya conocemos), así que basta con reconocer un equipo por fila.
   Solo se descarga la imagen si es nueva (se guarda la dirección de la última leída).
2. Genera los calendarios .ics del Zaragoza (suscripción y uno por partido) con la hora de
   realzaragoza.com (data/official.json → calendar) o, si aún no está, la de la RFEF.

Uso: python3 tools/horarios_rfef.py [--force J,J] [--only-ics] [--image J=fichero.png]
"""
import json, os, re, sys, shutil, subprocess, tempfile, time, difflib, unicodedata, hashlib
import urllib.request, urllib.error
from datetime import datetime, timedelta, timezone, date
from zoneinfo import ZoneInfo

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
P = lambda *a: os.path.join(ROOT, *a)
UA = 'Mozilla/5.0 (compatible; NoblezaYValor/1.0; app personal de estadisticas)'
MAD = ZoneInfo('Europe/Madrid')
SITE = 'https://fjaenj.github.io/real-zaragoza-stats/'
NEWS = 'https://rfef.es/es/noticias/horarios-y-televisiones-de-la-jornada-{j}-de-primera-federacion-temporada-202627'


def log(*a): print(*a, flush=True)


def read_json(path, default=None):
    try:
        with open(path, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError:
        return default


def write_json(path, obj):
    with open(path, 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))


def http_get(url, binary=False):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else data.decode('utf-8', 'replace')


# ---------------------------------------------------------------- OCR
def ensure_ocr():
    try:
        import PIL  # noqa
        have_pil = True
    except ImportError:
        have_pil = False
    if not have_pil or not shutil.which('tesseract'):
        log('Instalando tesseract y Pillow…')
        subprocess.run('sudo apt-get update -qq && sudo apt-get install -y -qq tesseract-ocr python3-pil >/dev/null',
                       shell=True, check=True)
        import importlib; importlib.invalidate_caches()


def tesseract(img, args):
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as t:
        img.save(t.name)
    try:
        out = subprocess.run(['tesseract', t.name, '-', '--psm', '6'] + args, capture_output=True, text=True).stdout
    finally:
        os.unlink(t.name)
    return out.strip()


def read_poster(path):
    """Devuelve una lista de filas {'date': 'S 14/11 | 21:00 h', 'names': '...'} del cartel."""
    from PIL import Image, ImageFilter, ImageOps, ImageChops
    im = Image.open(path).convert('RGB')
    W, H = im.size
    blur = im.filter(ImageFilter.BoxBlur(18)).load()
    px = im.load()
    y0, y1 = int(H * 0.22), int(H * 0.93)

    def red(x, y):  # texto rojo/naranja (fecha y hora) sobre fondo oscuro
        r, g, b = px[x, y]
        return r >= 190 and g < 170 and b < 120 and blur[x, y][0] < 130

    # columna de fecha: el bloque ancho más denso de texto rojo
    cc = [sum(1 for y in range(y0, y1, 2) if red(x, y)) for x in range(W)]
    bins = [sum(cc[x:x + 20]) for x in range(0, W, 20)]
    runs, s = [], None
    for i, v in enumerate(bins + [0]):
        if v > 500 and s is None: s = i
        if v <= 500 and s is not None: runs.append((s, i)); s = None
    if not runs: return []
    a, b = max(runs, key=lambda r: r[1] - r[0])
    x0, x1 = max(0, a * 20 - 6), min(W, b * 20 + 6)
    # líneas de texto dentro de esa columna, agrupadas por filas (fecha + hora)
    rc = [sum(1 for x in range(x0, x1) if red(x, y)) for y in range(H)]
    lines, s = [], None
    for y in range(H):
        if rc[y] > 1 and s is None: s = y
        if rc[y] <= 1 and s is not None:
            if y - s > 8: lines.append((s, y))
            s = None
    rows = []
    for l in lines:
        if rows and l[0] - rows[-1][1] < 25: rows[-1] = (rows[-1][0], l[1])
        else: rows.append(l)
    out = []
    for ra, rb in rows:
        ya, yb = max(0, ra - 12), min(H, rb + 12)
        d = ImageOps.invert(im.crop((x0, ya, x1, yb)).getchannel('R'))
        d = d.resize((d.width * 3, d.height * 3), Image.LANCZOS)
        dt = tesseract(d, ['-c', 'tessedit_char_whitelist=LMXJVSD0123456789/:.h '])
        n = im.crop((20, max(0, ya - 10), max(21, x0 - 20), min(H, yb + 10)))
        r_, g_, b_ = n.split()
        m = ImageOps.invert(ImageChops.darker(ImageChops.darker(r_, g_), b_))  # blanco → negro
        m = m.resize((m.width * 2, m.height * 2), Image.LANCZOS)
        nt = tesseract(m, [])
        out.append({'date': dt.replace('\n', ' | '), 'names': nt.replace('\n', ' | ')})
    return out


# ---------------------------------------------------------------- emparejar
STOP = {'cf', 'fc', 'ud', 'cd', 'sd', 'ad', 'ce', 'ue', 'real', 'de', 'club', 'sad', 'b', 'r'}
EXTRA = {'RMJ': ['Rayo Majadahonda'], 'VIL': ['Villarreal B'], 'JUV': ['Juventud Torremolinos'],
         'ATM': ['Atlético Madrileño'], 'GIM': ['Gimnàstic Tarragona'], 'HER': ['Hércules Alicante']}


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.findall(r'[a-z]+', s)


def team_tokens(t):
    names = [t.get('rfef'), t.get('name'), t.get('short'), t.get('city')] + EXTRA.get(t['code'], [])
    return [toks for toks in ({w for w in norm(n) if w not in STOP and len(w) > 2} for n in names if n) if toks]


def team_score(tokens_sets, words):
    best = 0
    for toks in tokens_sets:
        hit = sum(1 for tk in toks if any(difflib.SequenceMatcher(None, tk, w).ratio() >= 0.78 for w in words))
        best = max(best, hit / len(toks))
    return best


DOW = {'L': 0, 'M': 1, 'X': 2, 'J': 3, 'V': 4, 'S': 5, 'D': 6}


def parse_when(txt, nominal):
    """'S 14/11 | 21:00 h' → datetime local (Madrid) o None. Comprueba el día de la semana."""
    t = txt.replace(' ', '')
    m = re.search(r'([LMXJVSD])?(\d{1,2})/(\d{1,2})', t)
    h = re.search(r'(\d{1,2})[:.](\d{2})', t[m.end():] if m else t)
    if not m or not h: return None, 'sin fecha u hora'
    dd, mm, hh, mi = int(m.group(2)), int(m.group(3)), int(h.group(1)), int(h.group(2))
    if not (1 <= mm <= 12 and 1 <= dd <= 31 and 9 <= hh <= 23 and mi < 60): return None, 'valores raros'
    year = nominal.year if abs(mm - nominal.month) < 6 else (nominal.year + 1 if mm < nominal.month else nominal.year - 1)
    try: dt = datetime(year, mm, dd, hh, mi, tzinfo=MAD)
    except ValueError: return None, 'fecha imposible'
    if m.group(1) and DOW[m.group(1)] != dt.weekday(): return None, f'día de la semana no cuadra ({m.group(1)} vs {dt:%a})'
    if abs((dt.date() - nominal).days) > 60: return None, 'demasiado lejos de la jornada'
    return dt, None


def match_rows(rows, fixtures, teams):
    toks = {t['code']: team_tokens(t) for t in teams}
    nominal = date.fromisoformat(fixtures[0]['date'])
    cands = []
    for i, r in enumerate(rows):
        words = norm(r['names'])
        for f in fixtures:
            sh, sa = team_score(toks[f['h']], words), team_score(toks[f['a']], words)
            cands.append((sh + sa, min(sh, sa), i, f))
    cands.sort(key=lambda c: (-c[0], -c[1]))
    used_r, used_f, out = set(), set(), []
    for sc, mn, i, f in cands:
        key = f['h'] + '_' + f['a']
        if i in used_r or key in used_f or sc < 0.5: continue
        dt, err = parse_when(rows[i]['date'], nominal)
        used_r.add(i); used_f.add(key)
        if not dt:
            log(f"   ? {key}: no leo bien «{rows[i]['date']}» ({err})")
            continue
        out.append({'h': f['h'], 'a': f['a'], 'local': dt.strftime('%Y-%m-%dT%H:%M'),
                    'utc': dt.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')})
    return out


# ---------------------------------------------------------------- calendarios
def ics_escape(s): return s.replace('\\', '\\\\').replace(';', '\\;').replace(',', '\\,').replace('\n', '\\n')


def fold(line):
    b = line.encode('utf-8')
    if len(b) <= 74: return line
    parts, cur = [], b''
    for ch in line:
        c = ch.encode('utf-8')
        if len(cur) + len(c) > (74 if not parts else 73): parts.append(cur.decode('utf-8')); cur = b''
        cur += c
    parts.append(cur.decode('utf-8'))
    return '\r\n '.join(parts)


def zar_events(season, off, sched):
    teams = {t['code']: t for t in season['teams']}
    cal = {m['j']: m for m in (off.get('calendar') or []) if m.get('comp') == 'liga'}
    rf = {}
    for j, d in (sched.get('rfef') or {}).items():
        for r in d.get('rows', []): rf[(int(j), r['h'], r['a'])] = r['utc']
    evs = []
    for f in sorted((f for f in season['fixtures'] if 'ZAR' in (f['h'], f['a'])), key=lambda f: f['j']):
        j, home = f['j'], f['h'] == 'ZAR'
        opp = teams[f['a'] if home else f['h']]
        c = cal.get(j, {})
        when = c.get('time') or rf.get((j, f['h'], f['a']))
        day = c.get('date') or f['date']
        hn, an = (teams['ZAR']['name'], opp['name']) if home else (opp['name'], teams['ZAR']['name'])
        venue = c.get('venue') or ('Ibercaja Estadio' if home else opp.get('stadium'))
        city = 'Zaragoza' if home else opp.get('city')
        score = ''
        if f.get('hg') is not None: score = f" ({f['hg']}-{f['ag']})"
        om = (off.get('matches') or {}).get(str(j))
        if om and om.get('finished') and om.get('hs') is not None: score = f" ({om['hs']}-{om['as']})"
        evs.append({'j': j, 'title': f"⚽ {hn} - {an}{score}", 'when': when, 'day': day, 'venue': venue, 'city': city,
                    'home': home, 'confirmed': bool(when)})
    # Copa y otras competiciones que publica el club
    for c in off.get('calendar') or []:
        if c.get('comp') == 'liga': continue
        evs.append({'j': None, 'comp': c['comp'], 'round': c.get('round'), 'title': f"🏆 {c['home']} - {c['away']} ({c['comp']})",
                    'when': c.get('time'), 'day': c['date'], 'venue': c.get('venue'), 'city': '', 'home': c.get('homeZar'),
                    'confirmed': bool(c.get('time')), 'uid': 'nyv-' + re.sub(r'[^a-z0-9]+', '-', (c.get('slug') or c['date']).lower())})
    return evs


def vevent(e, stamp):
    uid = e.get('uid') or f"nyv-liga-2627-j{e['j']:02d}"
    loc = ', '.join(x for x in [e.get('venue'), e.get('city')] if x)
    what = f"1ª Federación · Grupo 2 · Jornada {e['j']}" if e['j'] else f"{e.get('comp')} · {(e.get('round') or '').replace('Jornada', 'Ronda')}".strip(' ·')
    if e['confirmed']:
        st = datetime.strptime(e['when'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)
        times = [f"DTSTART:{st:%Y%m%dT%H%M%SZ}", f"DTEND:{st + timedelta(hours=2):%Y%m%dT%H%M%SZ}"]
        desc, title = what, e['title']
    else:
        d = date.fromisoformat(e['day'])
        times = [f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}"]
        desc = what + '\nHorario por confirmar: la RFEF lo fija con 2-3 semanas de antelación. Si estás suscrito, se actualiza solo.'
        title = e['title'] + ' (horario por confirmar)'
    lines = ['BEGIN:VEVENT', f'UID:{uid}@nobleza-y-valor', f'DTSTAMP:{stamp}', *times,
             f'SUMMARY:{ics_escape(title)}', f'LOCATION:{ics_escape(loc)}',
             f'DESCRIPTION:{ics_escape(desc + chr(10) + SITE)}', f'URL:{SITE}', 'END:VEVENT']
    return lines


def calendar_text(evs, name, stamp):
    head = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nobleza y valor//Real Zaragoza 26-27//ES', 'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH', f'X-WR-CALNAME:{ics_escape(name)}', 'X-WR-TIMEZONE:Europe/Madrid',
            'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H']
    body = [l for e in evs for l in vevent(e, stamp)]
    return '\r\n'.join(fold(l) for l in head + body + ['END:VCALENDAR']) + '\r\n'


def write_calendars(season, off, sched):
    evs = zar_events(season, off, sched)
    os.makedirs(P('cal'), exist_ok=True)
    files = {'cal/zaragoza.ics': ('Real Zaragoza 26/27', evs)}
    for e in evs:
        if e['j']: files[f"cal/j{e['j']:02d}.ics"] = (f"Real Zaragoza · J{e['j']}", [e])
    hashes = sched.setdefault('icsHash', {})
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    n = 0
    for path, (name, ev) in files.items():
        h = hashlib.sha1(calendar_text(ev, name, 'X').encode()).hexdigest()[:12]
        if hashes.get(path) == h and os.path.exists(P(path)): continue
        with open(P(path), 'w', encoding='utf-8', newline='') as f: f.write(calendar_text(ev, name, stamp))
        hashes[path] = h; n += 1
    log(f'Calendarios: {n} actualizados ({sum(1 for e in evs if e["confirmed"])} partidos con hora)')
    return n


# ---------------------------------------------------------------- principal
def main():
    args = sys.argv[1:]
    force = set()
    images = {}
    only_ics = '--only-ics' in args
    for i, a in enumerate(args):
        if a == '--force' and i + 1 < len(args): force = {int(x) for x in args[i + 1].split(',') if x.strip()}
        if a == '--image' and i + 1 < len(args):
            j, f = args[i + 1].split('=', 1); images[int(j)] = f
    force |= {int(x) for x in os.environ.get('FORCE_J', '').split(',') if x.strip().isdigit()}

    season = read_json(P('data/season.json'))
    off = read_json(P('data/official.json'), {}) or {}
    sched = read_json(P('data/schedule.json'), {}) or {}
    before = json.dumps(sched, sort_keys=True)
    sched.setdefault('rfef', {})
    today = datetime.now(MAD).date()

    by_j = {}
    for f in season['fixtures']: by_j.setdefault(f['j'], []).append(f)

    if not only_ics:
        todo = []
        for j, fx in sorted(by_j.items()):
            nominal = date.fromisoformat(fx[0]['date'])
            known = sched['rfef'].get(str(j), {})
            complete = len(known.get('rows', [])) >= len(fx)
            # jornadas que aún no se han jugado y llegan en las próximas 4 semanas;
            # si ya están completas, solo se revisan (por si hay cartel corregido) en la última semana
            soon = -2 <= (nominal - today).days <= 30
            if j in force or j in images or (soon and (not complete or (nominal - today).days <= 7)):
                todo.append(j)
        log('Jornadas a revisar:', todo or 'ninguna')
        ocr_ready = False
        for j in todo:
            known = sched['rfef'].get(str(j), {})
            try:
                if j in images:
                    src, img_path = 'local:' + images[j], images[j]
                else:
                    try: html = http_get(NEWS.format(j=j))
                    except urllib.error.HTTPError as e:
                        log(f'J{j}: sin noticia de horarios todavía (HTTP {e.code})'); time.sleep(1.5); continue
                    m = re.search(r'src="([^"]*_g2_[^"]*\.(?:png|jpe?g|webp)[^"]*)"', html, re.I) or \
                        re.search(r'src="([^"]*g2[^"]*\.(?:png|jpe?g|webp)[^"]*)"', html, re.I)
                    if not m: log(f'J{j}: noticia sin cartel del Grupo 2'); continue
                    src = m.group(1).replace('&amp;', '&')
                    if src.startswith('/'): src = 'https://rfef.es' + src
                    if src == known.get('src') and j not in force:
                        log(f'J{j}: cartel ya leído'); time.sleep(1.5); continue
                    time.sleep(1.5)
                    img_path = os.path.join(tempfile.gettempdir(), f'nyv_j{j}.png')
                    with open(img_path, 'wb') as f: f.write(http_get(src, binary=True))
                if not ocr_ready: ensure_ocr(); ocr_ready = True
                rows = read_poster(img_path)
                got = match_rows(rows, by_j[j], season['teams'])
                log(f'J{j}: {len(rows)} filas en el cartel, {len(got)}/{len(by_j[j])} partidos con hora')
                for r in got: log(f"   {r['h']}-{r['a']} {r['local']}")
                if got:
                    sched['rfef'][str(j)] = {'src': src, 'read': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                                             'news': NEWS.format(j=j), 'rows': got}
            except Exception as e:
                log(f'J{j}: error {e!r}')
            time.sleep(1.5)

    write_calendars(season, off, sched)
    if json.dumps(sched, sort_keys=True) != before:
        sched['updated'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        sched['source'] = 'rfef.es (carteles de horarios por jornada) y realzaragoza.com'
        write_json(P('data/schedule.json'), sched)
        log('schedule.json actualizado')
    else:
        log('Horarios: nada nuevo')


if __name__ == '__main__':
    main()
