# Estos agentes son una COPIA

La fuente donde se editan es:

    ~/Library/Mobile Documents/com~apple~CloudDocs/CENT CLAUDE/.claude/agents/

Están copiados aquí porque el harness de Claude Code solo registra los `.claude/agents/`
del **directorio de trabajo**. Mientras vivieran únicamente en la carpeta CENT CLAUDE,
la instrucción del `CLAUDE.md` de este repo —«antes de tocar un módulo, delega en su
subagente»— era **inalcanzable**: el mecanismo estaba escrito y no estaba conectado. Es el
mismo patrón que este repo ya pagó con los crons y con `check:leyes-vigentes`.

## El precio, y cómo se paga

Cinco copias divergen. Ya pasó: el 2026-09-03, al copiar iCloud → repos,
`luisfers-designer.md` de los repos resultó **más nuevo** que el de iCloud, y una copia
ciega borró 35 líneas de trabajo sin que nada se pusiera en rojo (se revirtió con
`git checkout`).

Por eso el sync **no sobrescribe por defecto**:

    node "~/Library/Mobile Documents/com~apple~CloudDocs/CENT CLAUDE/sync-agentes.mjs"

Reporta divergencias y no toca nada. Para resolverlas:

    ... sync-agentes.mjs --push    # CENT CLAUDE → repos
    ... sync-agentes.mjs --pull    # repos → CENT CLAUDE

Ninguno de los dos pisa el lado más nuevo salvo con `--force`. Si los dos lados cambiaron,
lo dice y no elige por ti.

## Si editas un agente

Edítalo en CENT CLAUDE y corre `--push`. Si lo editaste aquí por comodidad, corre `--pull`
**antes** de que alguien más haga `--push`, o tu cambio se pierde en el siguiente sync.
