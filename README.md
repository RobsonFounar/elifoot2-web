# Elifoot II v1.21 Web

![InitImage](./elifoot2-init.png)

## Jogar

**https://robsonfounar.github.io/elifoot2-web/**

Abre a página e carrega em **JOGAR**. Funciona no computador (teclado) e no telemóvel (barra de teclas tátil).
A versão antiga do player continua disponível em `classic.html`.

## Campeonatos

No ecrã de início escolhe o campeonato (cada um tem as suas gravações):

- **Brasil 2026** (predefinido) — os 20 clubes da Série A 2026 + Ceará, Fortaleza, Juventude, Sport, Goiás,
  América-MG, Criciúma, Avaí, Ponte Preta, Cuiabá, Atlético-GO e Náutico, em 4 divisões de 8,
  com elencos atuais (Wikipedia, outubro 2026) e treinadores brasileiros. Ficheiro: `Elifoot_II_v1.21_BR.jsdos`.
- **Portugal 1998/99** — os ficheiros originais. Ficheiro: `Elifoot_II_v1.21.jsdos`.

Para atualizar os elencos: `python tools/fetch_squads.py squads.json` e depois
`python tools/build_br.py squads.json Elifoot_II_v1.21.jsdos Elifoot_II_v1.21_BR.jsdos`.
Nota: o jogo verifica o tamanho exato de `EQUIPAS.EF2` e `TREINAD.EF2`; o script acerta-o com espaços.



## Como gravar

Para gravar o jogo, tem de se usar a combinação dentro do jogo:

```alt+f1 -> enter -> enter```

depois, carregar no icon de disquete no topo esquerdo para proceder à gravação.



## Combinações de teclas

Quase todas as combinações funcionam diretamente com o teclado. As que o sistema/browser não deixa passar
— sobretudo o **ALT+F4 (Treinadores)** — estão na barra de teclas (botão ⌨ no canto inferior direito):

- **Atalhos:** Alt+F1…F4, Ctrl+F1…F3, Shift+F1…F3.
- **Alt / Ctrl / Shift:** um toque prende a tecla para a seguinte, dois toques bloqueiam, três soltam.
- **ABC:** letras e números para combinações como Alt+letra.
- F1–F12, Esc, Tab, setas, PgUp/PgDn, Enter, etc.
- 💾 grava as alterações (o mesmo que o ícone de disquete).

No telemóvel a barra abre automaticamente.



### Agradecimentos

- Dosbox
- Emscripten
- js-dos



## Source Original

https://github.com/rodvlopes/elifoot2-web
