import json
R="""AGU: ALC 2-2, HER 0-1, HUE 2-2, IBI 1-2, RMC 1-0
ALC: EUR 0-0, GIM 3-0, HUE 1-1, IBI 3-3, JUV 5-0
ALG: AGU 1-1, CAR 1-3, HER 2-0, RMJ 1-0, RMC 2-0
ANT: ALC 1-1, CAR 1-1, IBI 3-2, JAE 2-0, MUR 0-1
ATM: ALC 1-1, JAE 1-1, JUV 2-2, MUR 4-0, VIL 1-3, ZAR 4-4
CAR: AGU 4-1, EUR 3-0, GIM 0-0, MUR 1-0
EUR: ALG 2-1, HER 1-2, JAE 0-3, RMJ 1-0, ZAR 0-1
GIM: ALG 4-2, ATM 2-1, HER 4-2, SAN 1-2, ZAR 2-0
HER: ATM 0-2, JAE 0-0, JUV 1-0, MUR 1-2, RMJ 2-0, SAN 1-0
HUE: ANT 1-1, ATM 0-0, EUR 3-1, SAN 1-0, VIL 0-3
IBI: EUR 3-0, RMJ 2-1, RMC 1-1, SAN 2-0, ZAR 0-2
JAE: HUE 2-2, IBI 2-1, RMJ 1-0, VIL 3-3
JUV: AGU 0-0, ALG 1-2, GIM 2-2, MUR 1-0, ZAR 3-4
MUR: EUR 2-1, GIM 2-0, TER 4-0, ZAR 0-0
RMJ: CAR 1-1, MUR 0-1, SAN 2-1, TER 2-0, VIL 1-2
RMC: ALC 1-2, ANT 3-2, ATM 3-2, CAR 2-0, JUV 2-0
SAN: AGU 2-0, ANT 2-2, JUV 2-2, RMC 1-1, TER 2-0
TER: AGU 1-1, ALC 1-0, HUE 1-1, JAE 0-1, RMC 0-0
VIL: ALG 2-1, ANT 2-2, CAR 4-1, IBI 0-1, TER 2-0
ZAR: ANT 1-0, CAR 1-0, TER 4-1, VIL 2-2"""
res={}
for line in R.splitlines():
    h,rest=line.split(':')
    for it in rest.split(','):
        a,s=it.split(); x,y=map(int,s.split('-')); res[f"{h}_{a}"]=[x,y]
WIKI={"AGU":(10,1,5,4,9,15,8),"ALC":(10,3,6,1,18,10,15),"ALG":(9,4,1,4,13,13,13),"ANT":(10,2,5,3,14,14,11),"ATM":(10,2,5,3,18,16,11),
"CAR":(10,4,3,3,14,11,15),"EUR":(10,2,1,7,6,18,7),"GIM":(9,4,2,3,15,14,14),"HER":(10,5,1,4,10,11,16),"HUE":(9,2,6,1,11,11,12),
"IBI":(10,5,2,3,17,13,17),"JAE":(9,4,4,1,13,9,16),"JUV":(10,1,4,5,11,20,7),"MUR":(10,6,1,3,12,8,19),"RMJ":(10,2,1,7,7,12,7),
"RMC":(10,4,3,3,13,11,15),"SAN":(10,3,3,4,12,12,12),"TER":(10,1,3,6,4,17,6),"VIL":(10,6,3,1,23,12,21),"ZAR":(10,6,3,1,19,12,21)}
st={k:[0]*7 for k in WIKI}
for k,(x,y) in res.items():
    h,a=k.split('_')
    for t,gf,ga in ((h,x,y),(a,y,x)):
        s=st[t]; s[0]+=1; s[4]+=gf; s[5]+=ga
        if gf>ga: s[1]+=1; s[6]+=3
        elif gf==ga: s[2]+=1; s[6]+=1
        else: s[3]+=1
bad=[(k,tuple(st[k]),WIKI[k]) for k in WIKI if tuple(st[k])!=WIKI[k]]
print('partidos',len(res),'discrepancias',bad)
json.dump(res,open('data/raw/resultados_g2_2627_wiki_en_20261101.json','w'))
