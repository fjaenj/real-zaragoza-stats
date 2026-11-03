import json, collections
raw=json.load(open('data/raw/apifootball_2022_2024.json'))
c2526=json.load(open('data/raw/curvas_2526.json'))
NAMEFIX={'Deportivo La Coruna':'Deportivo','Racing Ferrol':'Racing de Ferrol','AD Ceuta FC':'Ceuta','Castellón':'Castellón','Amorebieta':'Amorebieta','Cultural Leonesa':'Cultural Leonesa'}
seasons=[]
for key in ['435_2022','436_2022','435_2023','436_2023','435_2024','436_2024']:
    lg,yr=key.split('_'); yr=int(yr); g=1 if lg=='435' else 2
    d=raw[key]; fx=[f for f in d['fx'] if f[9] in ('FT','AET','PEN','AWD','WO')]
    teams={}
    for f in d['fx']: teams[f[3]]=f[4]; teams[f[7]]=f[8]
    # per-round points per team
    per=collections.defaultdict(dict)
    for f in fx:
        r=int(f[2].split('-')[-1].strip()); h,a=f[3],f[7]; gh,ga=f[5],f[6]
        if gh is None: continue
        ph=3 if gh>ga else 1 if gh==ga else 0; pa=3 if ga>gh else 1 if gh==ga else 0
        per[h][r]=(ph,gh,ga); per[a][r]=(pa,ga,gh)
    acc={}
    for t in teams:
        s=0; gd=0; gf=0; arr=[]
        for r in range(1,39):
            p=per[t].get(r)
            if p: s+=p[0]; gd+=p[1]-p[2]; gf+=p[1]
            arr.append((s,gd,gf))
        acc[t]=arr
    # rank per round
    bands={'p1':[],'p2':[],'p5':[],'p15':[]}
    for r in range(38):
        order=sorted(teams,key=lambda t:(-acc[t][r][0],-acc[t][r][1],-acc[t][r][2]))
        for k,pos in (('p1',0),('p2',1),('p5',4),('p15',14)):
            bands[k].append(acc[order[pos]][r][0])
    table=d['table'][0]
    champ=table[0]; cid=champ[1]
    curve=[acc[cid][r][0] for r in range(38)]
    assert curve[-1]==champ[3], (key,curve[-1],champ[3])
    nm=NAMEFIX.get(champ[2],champ[2])
    seasons.append({"season":f"{str(yr)[2:]}/{str(yr+1)[2:]}","group":g,"champion":nm,"points":champ[3],
        "record":{"w":champ[5],"d":champ[6],"l":champ[7],"gf":champ[8],"ga":champ[9]},
        "curve":curve,"bands":bands,
        "final":{"second":table[1][3],"fifth":table[4][3],"fifteenth":table[14][3]},
        "source":"API-Football"})
for code,nm,g,rec in (('TEN','Tenerife',1,{"w":22,"d":10,"l":6,"gf":62,"ga":24}),('ELD','Eldense',2,{"w":19,"d":12,"l":7,"gf":57,"ga":39})):
    cur=[x['acc'] for x in c2526[code]]
    seasons.append({"season":"25/26","group":g,"champion":nm,"points":cur[-1],"record":rec,"curve":cur,"bands":None,
       "final":{"second":65 if g==1 else 68,"fifth":58 if g==1 else 60,"fifteenth":44 if g==1 else 46},
       "matches":c2526[code],"source":"Wikipedia + calendario RFEF"})
seasons.sort(key=lambda s:(s['season'],s['group']),reverse=True)
for s in seasons: print(s['season'],s['group'],s['champion'],s['points'],'J10:',s['curve'][9], 'p5 J38' if s['bands'] else '', s['bands']['p5'][-1] if s['bands'] else '')
json.dump({"updated":"2026-11-03","seasons":seasons},open('data/history.json','w'),ensure_ascii=False,separators=(',',':'))
