import json
cal=json.load(open('data/raw/rfef_calendario_g2_2627.json'))
res=json.load(open('data/raw/resultados_g2_2627_wiki_en_20261101.json'))
TEAMS=[ # code, rfef name, short, en-wiki code, es-wiki code
("AGU","Águilas FC","Águilas","AGU","AGU"),("ALC","AD Alcorcón","Alcorcón","ALC","ALC"),("ALG","Algeciras CF","Algeciras","ALG","ALG"),
("ANT","Antequera CF","Antequera","ANT","ANT"),("ATM","Atlético Madrileño","At. Madrileño","ATM","ATM"),("CAR","FC Cartagena","Cartagena","CAR","CAR"),
("EUR","CE Europa","Europa","EUR","EUR"),("GIM","Gimnàstic de Tarragona","Gimnàstic","GIM","GIM"),("HER","Hércules de Alicante CF","Hércules","HER","HER"),
("HUE","SD Huesca","Huesca","HUE","HUE"),("IBI","UD Ibiza","Ibiza","IBI","IBI"),("JAE","Real Jaén CF","Jaén","JAE","JAE"),
("JUV","Juventud de Torremolinos CF","Juventud T.","JUV","JUV"),("MUR","Real Murcia CF","Murcia","MUR","RMU"),("RMJ","CF Rayo Majadahonda","Rayo Majadahonda","RMJ","RAY"),
("RMC","Real Madrid Castilla","RM Castilla","RMC","RMC"),("SAN","UE Sant Andreu","Sant Andreu","SAN","SAD"),("TER","CD Teruel","Teruel","TER","TER"),
("VIL",'Villarreal CF "B"',"Villarreal B","VIL","VIL"),("ZAR","Real Zaragoza","Real Zaragoza","ZAR","ZAR")]
byname={t[1]:t[0] for t in TEAMS}
fixtures=[]
seen=set()
for j,d,pairs in cal:
    dd,mm,yy=d.split('-')
    for h,a in pairs:
        hc,ac=byname[h],byname[a]; k=f"{hc}_{ac}"
        assert k not in seen; seen.add(k)
        r=res.get(k)
        fixtures.append({"j":j,"date":f"{yy}-{mm}-{dd}","h":hc,"a":ac,"hg":r[0] if r else None,"ag":r[1] if r else None})
assert len(fixtures)==380 and set(res)<=seen
played=[f for f in fixtures if f['hg'] is not None]
late=[(f['j'],f['h'],f['a']) for f in fixtures if f['j']<=10 and f['hg'] is None]
print('jugados',len(played),'pendientes J1-10:',late)
squad=[ # dorsal, nombre, pos, PJ, PT, min, goles, asist  (AupaZaragoza, tras J10)
(1,"Sem Westerveld","POR",9,9,810,0,0),(13,"Anartz Pena","POR",1,1,90,0,0),(None,"M. Manolache","POR",0,0,0,0,0),
(2,"Jokin Gabilondo","DEF",4,3,233,0,0),(3,"Raúl Pereira","DEF",8,5,522,0,0),(4,"Hugo Barrachina","DEF",1,0,5,0,0),(5,"Tachi","DEF",2,1,108,0,0),
(14,"Rubo Iranzo","DEF",9,9,792,2,0),(18,"Sergio Escudero","DEF",7,6,363,0,0),(21,"Diego González","DEF",9,9,781,2,1),(25,"Marco Sangalli","DEF",8,7,664,0,0),
(6,"Peter Ademo","MED",8,7,592,0,0),(8,"Ander Herrera","MED",6,5,373,0,0),(10,"Hugo Pinilla","MED",1,0,12,0,1),(15,"Yussif Saidu","MED",7,1,199,1,0),
(16,"Lucas Terrer","MED",9,8,695,0,0),(19,"Jamelli","MED",8,6,467,0,1),(23,"Óscar Ureña","MED",9,6,478,3,1),(26,"D. Monzón","MED",1,0,19,0,0),
(31,"Jaime Tobajas","MED",3,0,61,0,0),(7,"Marcos Cuenca","DEL",6,2,133,0,0),(9,"Pau Sans","DEL",9,3,364,1,1),(11,"Jaume Jardí","DEL",10,9,808,5,4),
(17,"Iker Vadillo","DEL",6,4,322,0,0),(20,"Joaquín Delgado","DEL",7,2,320,0,0),(22,"Edu Espiau","DEL",7,5,390,3,2)]
players=[{"n":n,"name":nm,"pos":p,"base":{"pj":pj,"pt":pt,"min":mi,"g":g,"a":a}} for n,nm,p,pj,pt,mi,g,a in squad]
print('goles plantilla',sum(p['base']['g'] for p in players),'(+1 p.p. Europa = ',sum(p['base']['g'] for p in players)+1,')')
season={"season":"2026/27","competition":"Primera Federación · Grupo 2","team":"ZAR","coach":"Ibai Gómez",
 "updated":"2026-11-01","source":"Calendario: RFEF · Resultados: Wikipedia (en) · Plantilla: AupaZaragoza.com (tras J10)",
 "teams":[{"code":c,"rfef":r,"short":s,"en":e,"es":x} for c,r,s,e,x in TEAMS],
 "fixtures":fixtures,"players":players,"baseRound":10,
 "micro":{"size":4,"target":7,"lastBlock":{"size":2,"target":6},"note":"Método de Ibai Gómez: bloques de 4 partidos con un mínimo de 7 puntos (69 puntos al final)."},
 "promotion":{"direct":1,"playoff":[2,5],"relegation":[16,20]}}
json.dump(season,open('data/season.json','w'),ensure_ascii=False,separators=(',',':'))
