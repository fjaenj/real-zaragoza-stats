import json
TEN_RES={"ANS_TEN":"1–4","ANT_TEN":"0–1","AVI_TEN":"0–1","BAR_TEN":"2–0","ATH_TEN":"0–0","CAC_TEN":"0–0","CEL_TEN":"1–1","GUA_TEN":"0–2","LUG_TEN":"2–2","MER_TEN":"1–1","OSA_TEN":"0–2","OUR_TEN":"2–1","PNF_TEN":"1–1","PNT_TEN":"0–2","RFE_TEN":"0–2","RMC_TEN":"1–3","TAL_TEN":"0–0","TEN_ANS":"2–0","TEN_ANT":"1–0","TEN_AVI":"2–2","TEN_BAR":"2–0","TEN_ATH":"0–1","TEN_CAC":"1–1","TEN_CEL":"4–0","TEN_GUA":"4–0","TEN_LUG":"1–1","TEN_MER":"3–0","TEN_OSA":"1–0","TEN_OUR":"3–0","TEN_PNF":"2–0","TEN_PNT":"3–0","TEN_RFE":"0–1","TEN_RMC":"4–2","TEN_TAL":"1–0","TEN_UNI":"0–2","TEN_ZAM":"3–1","UNI_TEN":"2–1","ZAM_TEN":"0–1"}
ELD_RES={"ALC_ELD":"1–1","ALG_ELD":"1–1","ANT_ELD":"2–1","ATM_ELD":"1–1","ASL_ELD":"1–4","BET_ELD":"0–1","CAR_ELD":"0–0","ELD_ALC":"2–2","ELD_ALG":"3–2","ELD_ANT":"1–3","ELD_ATM":"2–1","ELD_ASL":"1–0","ELD_BET":"2–0","ELD_CAR":"2–1","ELD_EUR":"3–0","ELD_GIM":"4–1","ELD_HER":"2–0","ELD_IBI":"3–0","ELD_JUV":"3–3","ELD_MAR":"3–1","ELD_MUR":"1–1","ELD_SAB":"2–1","ELD_SEV":"1–0","ELD_TAR":"1–0","ELD_TER":"2–0","ELD_VIL":"1–0","EUR_ELD":"1–1","GIM_ELD":"3–0","HER_ELD":"2–1","IBI_ELD":"0–1","JUV_ELD":"1–1","MAR_ELD":"1–0","MUR_ELD":"3–0","SAB_ELD":"0–0","SEV_ELD":"2−2","TAR_ELD":"1–2","TER_ELD":"1–1","VIL_ELD":"2–0"}
TEN_SEQ="A GUA,H MER,A PNT,H OUR,A RMC,H ZAM,A CAC,H UNI,A BAR,A RFE,H ATH,H CEL,A ANS,H ANT,A LUG,A AVI,H PNF,A OSA,H TAL,A ZAM,H RMC,H GUA,A ATH,H RFE,A ANT,H AVI,H LUG,A CEL,H OSA,A TAL,H CAC,A MER,H ANS,A PNF,H BAR,A UNI,H PNT,A OUR"
ELD_SEQ="A SAB,H VIL,A TER,H SEV,A GIM,H JUV,A MAR,A EUR,H MUR,H ALG,A ATM,H HER,A CAR,H ANT,A ALC,H TAR,H BET,A IBI,H ASL,A JUV,H TER,A ALG,H SAB,A VIL,H ALC,A HER,H GIM,A ASL,H IBI,A TAR,H EUR,A BET,H CAR,A ANT,H MAR,A SEV,H ATM,A MUR"
NAMES={'TEN':{'GUA':'Guadalajara','MER':'Mérida','PNT':'Pontevedra','OUR':'Ourense CF','RMC':'RM Castilla','ZAM':'Zamora','CAC':'Cacereño','UNI':'Unionistas','BAR':'Barakaldo','RFE':'Racing Ferrol','ATH':'Bilbao Athletic','CEL':'Celta Fortuna','ANS':'Arenas','ANT':'Arenteiro','LUG':'Lugo','AVI':'Avilés','PNF':'Ponferradina','OSA':'Osasuna B','TAL':'Talavera'},
'ELD':{'SAB':'Sabadell','VIL':'Villarreal B','TER':'Teruel','SEV':'Sevilla Atlético','GIM':'Gimnàstic','JUV':'Juventud Torremolinos','MAR':'Marbella','EUR':'Europa','MUR':'Murcia','ALG':'Algeciras','ATM':'Atlético Madrileño','HER':'Hércules','CAR':'Cartagena','ANT':'Antequera','ALC':'Alcorcón','TAR':'Tarazona','BET':'Betis Deportivo','IBI':'Ibiza','ASL':'Atlético Sanluqueño'}}
def build(me,res,seq):
    out=[];pts=0
    for j,s in enumerate(seq.split(','),1):
        ha,op=s.split()
        key=f"{me}_{op}" if ha=='H' else f"{op}_{me}"
        a,b=[int(x) for x in res[key].replace('−','–').split('–')]
        gf,ga=(a,b) if ha=='H' else (b,a)
        p=3 if gf>ga else 1 if gf==ga else 0; pts+=p
        out.append({"j":j,"ha":ha,"rival":NAMES[me][op],"gf":gf,"ga":ga,"pts":p,"acc":pts})
    return out
t=build('TEN',TEN_RES,TEN_SEQ); e=build('ELD',ELD_RES,ELD_SEQ)
print('TEN J10',t[9]['acc'],'final',t[-1]['acc'],'GF',sum(x['gf'] for x in t),'GA',sum(x['ga'] for x in t))
print('ELD J10',e[9]['acc'],'final',e[-1]['acc'],'GF',sum(x['gf'] for x in e),'GA',sum(x['ga'] for x in e))
json.dump({"TEN":t,"ELD":e},open('data/raw/curvas_2526.json','w'),ensure_ascii=False)
