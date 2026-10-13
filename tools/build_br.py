import json, re, sys, zipfile, unicodedata, collections
SQUADS, SRC, DST = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(SQUADS, encoding="utf-8"))

# (chave, nome no jogo (máx 14), cor texto, cor fundo) — 4 divisões de 8 (1.ª divisão: os 8 grandes de SP/RJ/RS)
TEAMS = [
 ("SANTOS","SANTOS",0,7),("CORINTHIANS","CORINTHIANS",15,0),("SAO PAULO","SÃO PAULO",4,7),("PALMEIRAS","PALMEIRAS",15,2),
 ("FLAMENGO","FLAMENGO",0,4),("FLUMINENSE","FLUMINENSE",10,4),("VASCO","VASCO DA GAMA",15,0),("GREMIO","GRÊMIO",0,3),
 ("CRUZEIRO","CRUZEIRO",15,1),("MIRASSOL","MIRASSOL",14,2),("BOTAFOGO","BOTAFOGO",15,0),("BAHIA","BAHIA",12,1),
 ("BRAGANTINO","BRAGANTINO",15,4),("ATLETICO-MG","ATLÉTICO-MG",0,7),("VITORIA","VITÓRIA",0,4),("INTERNACIONAL","INTERNACIONAL",15,4),
 ("CORITIBA","CORITIBA",15,2),("ATHLETICO-PR","ATHLETICO-PR",0,4),("CHAPECOENSE","CHAPECOENSE",15,2),("REMO","REMO",15,1),
 ("FORTALEZA","FORTALEZA",12,1),("CEARA","CEARÁ",15,0),("SPORT","SPORT",0,4),("JUVENTUDE","JUVENTUDE",15,2),
 ("GOIAS","GOIÁS",15,2),("AMERICA-MG","AMÉRICA-MG",0,2),("CRICIUMA","CRICIÚMA",14,0),("AVAI","AVAÍ",15,1),
 ("PONTE PRETA","PONTE PRETA",15,0),("CUIABA","CUIABÁ",14,2),("ATLETICO-GO","ATLÉTICO-GO",0,4),("NAUTICO","NÁUTICO",15,4),
]
NAT = {"brazil":"BRA","argentina":"ARG","uruguay":"URU","uru":"URU","chile":"CHI","chi":"CHI","colombia":"COL","col":"COL",
 "ecuador":"EQU","ecu":"EQU","paraguay":"PAR","par":"PAR","peru":"PER","per":"PER","venezuela":"VEN","ven":"VEN",
 "bolivia":"BOL","bol":"BOL","spain":"ESP","esp":"ESP","italy":"ITA","ita":"ITA","portugal":"POR","por":"POR",
 "belgium":"BEL","bel":"BEL","england":"ING","eng":"ING","netherlands":"HOL","ned":"HOL","denmark":"DIN","den":"DIN",
 "croatia":"CRO","cro":"CRO","japan":"JAP","jpn":"JAP","morocco":"MAR","mar":"MAR","angola":"ANG","ang":"ANG",
 "cmr":"CAM","cameroon":"CAM","cod":"RDC","cpv":"CVE","ghana":"GAN","gha":"GAN","gnb":"GBI","guinea":"GUI","gui":"GUI",
 "panama":"PAN","pan":"PAN","senegal":"SEN","sen":"SEN","bra":"BRA","arg":"ARG","germany":"ALE","ger":"ALE",
 "france":"FRA","fra":"FRA","usa":"EUA","united states":"EUA","mexico":"MEX","mex":"MEX","costa rica":"CRC","crc":"CRC"}
POS = {"GK":"gr","DF":"df","MF":"md","FW":"av"}
NEED = [("GK",2),("DF",5),("MF",5),("FW",4)]

# O jogo desenha com a fonte DOS cp437. ã/õ seguem a convenção do ficheiro original (códigos cp860,
# que aparecem como ä/ö); o resto usa cp437 quando existe, senão a letra sem acento.
TILDE = {"ã": b"\x84", "Ã": b"\x8e", "õ": b"\x94", "Õ": b"\x99"}
def enc(s):
    out = b""
    for ch in s:
        if ch in TILDE: out += TILDE[ch]; continue
        try: out += ch.encode("cp437")
        except UnicodeEncodeError:
            out += unicodedata.normalize("NFKD", ch).encode("ascii", "ignore") or b"?"
    return out

def short(name, n=16):
    name = re.sub(r"\s*\(.*?\)", "", name).strip()
    if len(name) <= n: return name
    w = name.split()
    for cand in (f"{w[0]} {w[-1]}", f"{w[0][0]}. {w[-1]}", w[-1]):
        if len(cand) <= n: return cand
    return name[:n]

def num(p):
    try: return int(re.sub(r"\D", "", p["no"]) or 999)
    except ValueError: return 999

out, used = [], collections.Counter()
for key, tname, fg, bg in TEAMS:
    sq = sorted([p for p in d[key] if p["pos"] in POS and p["name"]], key=num)
    pick = []
    for pos, k in NEED:
        got = [p for p in sq if p["pos"] == pos][:k]
        pick += [(pos, p) for p in got]
        if len(got) < k:  # completa com outros jogadores de campo, assumindo a posição em falta
            rest = [p for p in sq if p not in [x[1] for x in pick] and p["pos"] != "GK"]
            pick += [(pos, p) for p in rest[:k - len(got)]]
    assert len(pick) == 16, (key, len(pick))
    lines = [enc(tname.ljust(14)[:14]) + b"BRA", str(fg).encode(), str(bg).encode()]
    for pos, p in pick:
        nat = NAT.get(p["nat"].strip().lower(), p["nat"].strip().upper()[:3] or "BRA")
        used[nat] += 1
        lines.append(enc(short(p["name"]).ljust(16)) + POS[pos].encode() + b" " + nat.encode())
    out.append(b"\r\n".join(lines))
equipas = b"\r\n\r\n".join(out) + b"\r\n\r\n"
# Mesmo tamanho que o original: espaços depois dos números das cores (linhas 2 e 3 de cada equipa).
orig_e = zipfile.ZipFile(SRC).read("EQUIPAS.EF2")
missing = len(orig_e) - len(equipas)
assert 0 <= missing <= 2 * len(out), missing
for n in range(missing):
    t, line = n % len(out), 1 + (n // len(out))
    parts = out[t].split(b"\r\n"); parts[line] += b" "; out[t] = b"\r\n".join(parts)
equipas = b"\r\n\r\n".join(out) + b"\r\n\r\n"
assert len(equipas) == len(orig_e)

COACHES = ["Filipe Luís","Abel Ferreira","Leonardo Jardim","Renato Gaúcho","Dorival Júnior","Tite","Rogério Ceni",
 "Fernando Diniz","Cuca","Mano Menezes","V. Luxemburgo","Luiz F. Scolari","Jorge Jesus","Carlo Ancelotti","Hernán Crespo",
 "Roger Machado","Juan P. Vojvoda","Odair Hellmann","Rafael Guanaes","Fábio Carille","Jair Ventura","Thiago Carpini",
 "Abel Braga","Muricy Ramalho","Levir Culpi","Paulo Autuori","Zé Ricardo","Guto Ferreira","Marcelo Fernandes","Lisca",
 "Eduardo Barroca","Enderson Moreira","Claudinei Oliveira","Umberto Louzer","Ricardo Catalá","Marquinhos Santos",
 "Gilmar Dal Pozzo","Hélio dos Anjos","Argel Fuchs","Ney Franco","Marcelo Chamusca","Rogério Micale","Jorginho",
 "Cristóvão Borges","Marcelo Oliveira","Oswaldo Oliveira","Joel Santana","Emerson Leão","Telê Santana","C. A. Parreira",
 "Zagallo","Paulo César Gusmão"]
COACHES = [short(c) for c in COACHES]
assert len(COACHES) == 52, len(COACHES)
# O jogo verifica o tamanho exato dos ficheiros: acertamos com espaços no fim das linhas.
orig_t = zipfile.ZipFile(SRC).read("TREINAD.EF2")
lines_t = [enc(c) for c in COACHES]
missing = len(orig_t) - len(b"\r\n".join(lines_t) + b"\r\n[EOF]\x1a\r\n")
assert missing >= 0, missing
i = 0
while missing > 0:
    lines_t[i % len(lines_t)] += b" "; missing -= 1; i += 1
treinad = b"\r\n".join(lines_t) + b"\r\n[EOF]\x1a\r\n"
assert len(treinad) == len(orig_t)

zin = zipfile.ZipFile(SRC)
with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        if info.filename == "EQUIPAS.EF2": data = equipas
        if info.filename == "TREINAD.EF2": data = treinad
        zout.writestr(info, data)
print("EQUIPAS", len(equipas), "TREINAD", len(treinad), "nacionalidades", dict(used))
print(equipas[:700].decode("cp860"))
