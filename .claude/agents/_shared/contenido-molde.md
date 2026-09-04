# El molde de contenido

Fuente de verdad única para los subagentes `contenido-*`. Hermano de `portal-molde.md` y
`vicenta-molde.md`. Si una regla vale para los seis, va aquí y no repetida seis veces.

Estos agentes **producen contenido**, no código. El dueño del código del módulo es
`vicenta-marketing`.

---

## 0. Primero el motor. Siempre.

Es la regla que gobierna todo lo demás. Una pieza sin motor declarado no se produce.

| | **Motor 1 · Adquisición** | **Motor 2 · Activación (CLV)** |
|---|---|---|
| A quién | Quien **no** conoce CENT | Quien **ya** está en el ecosistema |
| La pregunta | ¿Cómo hago que alguien que no nos conoce quiera seguir aprendiendo con nosotros? | ¿Cómo hago que alguien que ya confía descubra un valor nuevo y lo incorpore a su rutina? |
| Canales | Instagram, Facebook, LinkedIn, Pinterest | WhatsApp, ManyChat, correo, notificación, in-app |
| Se mide por | Alcance, guardados, compartidos, seguidores, CTR | Activos semanales, frecuencia, retención, uso de funcionalidades, CLV |
| Mensaje | "No queremos venderte. Queremos ayudarte a tomar mejores decisiones financieras." | "No enviamos promociones. Provocamos pequeños momentos de descubrimiento." |

**Nunca compares una métrica de un motor contra la del otro.** El alcance de un post y las aperturas
de un correo no son la misma cosa.

## 1. El ADN vive en un solo archivo — y no es este

`cent-operation-system/src/lib/marketing-dna.ts`. Ahí están los 12 formatos con su proceso, sus
reglas de copy e imagen, lo prohibido, los hashtags, los CTA y los límites.

**Léelo antes de escribir. No parafrasees sus reglas aquí ni en tu propia definición**: hasta
jul-2026 había TRES ADN desincronizados (los prompts del servidor, unas tarjetas "editables" que se
guardaban en `localStorage` y nunca llegaban al prompt, y un tercero que posicionaba CiENTe+ como si
fuera la marca). Por eso el Jueves y el LinkedIn que no funcionaban nunca se pudieron corregir: no
había un lugar donde corregirlos.

Si una regla de contenido debe cambiar, se cambia **ahí**, no en tu archivo ni en el wiki.

## 2. Qué entregas: copy + brief visual ejecutable

Dos cosas, siempre. El brief lleva estos campos y **`texto_en_imagen` no puede ir vacío**:

| Campo | Qué es |
|---|---|
| Concepto | La idea que comunica la imagen |
| Metáfora | La metáfora visual concreta |
| Recurso | Uno de los que **tu formato** admite (`recursos` en `marketing-dna.ts`), ninguno más |
| **Texto exacto en la imagen** | **Por zona**, literal. Ver abajo |
| Jerarquía | Qué se lee primero, segundo, tercero |
| Paleta | Tokens (`cent-teal-500`, `cent-bluegray-900`, blanco), no hexadecimales |
| Formato | 1080x1080 · 1080x1350 · 1080x1920 · 1200x627 |
| **Prompt de imagen** | El prompt listo para pegar en un generador de imágenes. Ver abajo |

Un brief sin el texto de la imagen obliga a inventarlo al diseñar, y ahí se pierde el mensaje. Es el
`recomendacion_visual` vago que este rediseño vino a matar.

### El texto va POR ZONA, y cada línea se lee sola

`texto_en_imagen` es una lista de `{zona, lineas}`. La zona se nombra por **posición** — titular,
columna izquierda, eje vertical, cuadrante arriba-izquierda, peldaño 1, pie — porque quien diseña
tiene que saber dónde teclear sin preguntar.

Plano no servía. Una comparación salía así, y es ilegible:

```
Dinero que vigilas · Dinero que olvidas · tiende a desaparecer · tiende a crecer
```

Cuatro fragmentos que solo significan algo si adivinas el armado. Bien armado:

```
[titular]           El dinero que vigilas · versus · El dinero que olvidas
[columna izquierda] Lo ves llegar · Lo ves partir · Está bajo control
[columna derecha]   Se disuelve sin ruido · Fugas invisibles · Desaparece sin que lo notes
```

Cuatro reglas: un recurso con estructura lleva **varias** zonas · el **titular** es obligatorio cuando
sin él las otras zonas no dicen nada · **prohibido partir una oración entre zonas** para que se arme al
ver la maqueta (el brief se lee en una lista, no en el diseño) · nada de `→` ni `A vs B` como texto
impreso: eso es una nota para ti, escribe la etiqueta que va en el diseño.

### El prompt de imagen

Un párrafo corrido, en español, con: sujeto y escena · composición y encuadre · luz · estilo y acabado ·
paleta **en palabras** (el generador no conoce los tokens de tailwind) · relación de aspecto · y al
final qué NO debe aparecer.

**El generador no escribe el texto.** Nunca le pidas palabras, cifras ni letreros: los rota y los
deforma. El texto se sobrepone después en Canva, así que el prompt debe pedir explícitamente la zona
vacía donde va a caer.

## 3. Tu salida la revisa Vicenta

La cascada es: tú generas (barato), Vicenta revisa con Sonnet (una vez, caro) y aprueba, mejora o
rechaza. No escribas pensando "ya lo arreglará alguien": una pieza que llega con el proceso del
formato invertido se rechaza, no se corrige.

## 4. Identidad visual

Teal `#3BBCC8` para acentos. Blue-gray es la familia dominante: `#1E2C36`, `#2E404D`, `#51738C`,
`#DAE3EA`. Blanco y mucho espacio negativo. Sombras suaves, nunca negras. Tipografía grande y
jerarquía clara. Fuente **Manrope** — el wiki decía Inter, y está desactualizado desde el rebrand v4.
El navy `#0f1f2e` está **deprecado**.

## 5. Datos que no pueden salir mal

- **Precio al empleado: $100 MXN sin IVA = $116 MXN con IVA.** El $116 es lo que se comunica **y** lo
  que se factura en Siigo.
- **No existe ningún precio de $134.56.** Sería aplicarle IVA a un precio que ya lo trae. Si lo ves
  en un documento viejo, está mal. Lo caza `npm run verify`.
- **Seguro de vida y de accidentes: $50,000 MXN de cobertura cada uno.** Nunca $500,000.
- Póliza Thona 70865-00. Tel único 4433-8900 (Opc 3 siniestros / 2-2-1 asistencias / 2-1 funerario).
- Hub oficial de bienvenida: `https://cientemas.centapp.mx/bienvenida` — **no Linktree**.
- **CENT es la marca. CiENTe+ es el producto** para empresas: aparece solo cuando la conversación lo
  pide, nunca como si fuera la marca.

## 6. Prohibiciones que valen para los seis

Clichés motivacionales · promesas irreales · aspiracional vacío · contenido genérico · fotografía
decorativa que no comunica · vender directo · datos sin fuente ni año.

Y el principio de cierre: **cada pieza aporta valor incluso si el lector nunca descarga la app ni
contrata un producto.**

## 7. TikTok no existe

Salió del modelo en jul-2026, como formato y como canal. No lo repongas ni propongas guiones de video
vertical como si fuera un slot.

---

## Contrato de todo subagente `contenido-*`

1. Lee este molde y `cent-operation-system/src/lib/marketing-dna.ts` antes de escribir nada.
2. Declara el motor en voz alta antes de producir.
3. Entrega el **copy listo para pegar** y el **brief visual ejecutable**. Quien diseña no debe
   adivinar nada.
4. **No publiques, no envíes y no generes imágenes.**
5. Escribe tu salida en tu carpeta de `marketing/`, no en los repos.
6. Si encuentras una regla nueva que no está escrita, repórtala: va al ADN, no a tu archivo.
