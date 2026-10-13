import json, re, sys, urllib.request, urllib.parse, os, time
OUT = sys.argv[1]
CLUBS = {
 "FLAMENGO":"CR Flamengo","PALMEIRAS":"Sociedade Esportiva Palmeiras","CRUZEIRO":"Cruzeiro Esporte Clube",
 "MIRASSOL":"Mirassol Futebol Clube","FLUMINENSE":"Fluminense FC","BOTAFOGO":"Botafogo de Futebol e Regatas",
 "BAHIA":"Esporte Clube Bahia","SAO PAULO":"São Paulo FC","GREMIO":"Grêmio Foot-Ball Porto Alegrense",
 "BRAGANTINO":"Red Bull Bragantino","ATLETICO-MG":"Clube Atlético Mineiro","SANTOS":"Santos FC",
 "CORINTHIANS":"Sport Club Corinthians Paulista","VASCO":"CR Vasco da Gama","VITORIA":"Esporte Clube Vitória",
 "INTERNACIONAL":"Sport Club Internacional","CORITIBA":"Coritiba Foot Ball Club","ATHLETICO-PR":"Club Athletico Paranaense",
 "CHAPECOENSE":"Associação Chapecoense de Futebol","REMO":"Clube do Remo","FORTALEZA":"Fortaleza Esporte Clube",
 "CEARA":"Ceará Sporting Club","SPORT":"Sport Club do Recife","JUVENTUDE":"Esporte Clube Juventude",
 "GOIAS":"Goiás Esporte Clube","AMERICA-MG":"América Futebol Clube (MG)","CRICIUMA":"Criciúma Esporte Clube",
 "AVAI":"Avaí FC","PONTE PRETA":"Associação Atlética Ponte Preta","CUIABA":"Cuiabá Esporte Clube",
 "ATLETICO-GO":"Atlético Clube Goianiense","NAUTICO":"Clube Náutico Capibaribe",
}
def wikitext(title):
    q = urllib.parse.urlencode({"action":"parse","page":title,"prop":"wikitext","redirects":1,"format":"json","formatversion":2})
    req = urllib.request.Request("https://en.wikipedia.org/w/api.php?"+q, headers={"User-Agent":"elifoot-squad-script/1.0 (personal project)"})
    for attempt in range(6):
        try:
            time.sleep(4)
            return json.load(urllib.request.urlopen(req, timeout=30))["parse"]["wikitext"]
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            time.sleep(20 * (attempt + 1))
    raise RuntimeError("429 persistente")
def players(wt):
    low = wt.lower()
    i = min([x for x in (low.find("{{fs start"), low.find("{{football squad start")) if x >= 0], default=-1)
    if i < 0: return None
    j = min([x for x in (low.find("{{fs end", i), low.find("{{football squad end", i), low.find("{{fs mid", i)) if x >= 0], default=len(wt))
    j2 = low.find("{{fs end", i)
    j = j2 if j2 >= 0 else j
    block = wt[i:j]
    res = []
    for m in re.finditer(r"\{\{\s*(?:Fs player|football squad player)\s*\|(.*?)\}\}(?=\s*(?:\n|\{\{|<))", block, re.S|re.I):
        d = {}
        for part in re.split(r"\|(?![^\[]*\]\])", m.group(1)):
            if "=" in part:
                k, v = part.split("=", 1); d[k.strip().lower()] = v.strip()
        name = d.get("name","")
        name = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", name)
        name = re.sub(r"\{\{sortname\|([^|}]*)\|([^|}]*)[^}]*\}\}", r"\1 \2", name, flags=re.I)
        name = re.sub(r"<[^>]*>|\{\{[^}]*\}\}|'''?", "", name).strip()
        res.append({"no": d.get("no",""), "pos": d.get("pos","").upper(), "nat": d.get("nat",""), "name": name, "other": d.get("other","")})
    return res
data = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else {}
for key, title in CLUBS.items():
    if data.get(key): continue
    try:
        wt = wikitext(title); p = players(wt)
        if p is None:
            m = re.search(r"\{\{([^{}|]*squad[^{}|]*)\}\}", wt, re.I)
            if m: p = players(wikitext("Template:"+m.group(1).strip()))
        data[key] = p or []
        print(key, len(data[key]))
    except Exception as e:
        print(key, "ERRO", e); data[key] = []
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
