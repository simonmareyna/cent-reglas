# @cent/reglas

Reglas de negocio compartidas entre **Cientemas-portal** (el portal del cliente) y
**cent-operation-system** (Vicenta, la herramienta interna de CENT).

## Por qué existe

Son dos apps de Next separadas, con su propio `package.json`, que no pueden importarse
entre sí. Las reglas que las dos necesitan estaban **copiadas a mano**, y eso ya falló:

> En julio de 2026 la lista de status cerrados de una denuncia divergió entre los dos
> repos. El portal no incluía `desestimada` y Vicenta sí. Resultado: `/analitica`
> reportaba **7 denuncias abiertas donde Vicenta reportaba 3**, y a 4 denuncias ya
> cerradas les aparecía la etiqueta "SLA vencido".
>
> Ni `tsc` ni `npm run build` lo detectan: las dos copias compilan perfecto por separado.

La regla del negocio es que **el número que ve el cliente y el que CENT le reporta tienen
que ser el mismo**. Con la regla en un solo lugar, no pueden separarse.

## Qué hay aquí

| Módulo | Regla |
|---|---|
| `@cent/reglas/rotacion` | Rotación mensual y anualizada. Qué mes es medible y cuál no (onboarding, ajuste de padrón, mes aproximado). |
| `@cent/reglas/quejas-sla` | Plazos del canal de denuncias (3/7/15 días) y qué status cuenta como cerrado. |
| `@cent/reglas/lista-movimientos` | Altas y bajas comparando la plantilla contra el snapshot del mes anterior. |

## Cómo se consume

Se distribuye como **TypeScript sin compilar**. Cada app lo transpila:

```js
// next.config
const nextConfig = { transpilePackages: ['@cent/reglas'] }
```

```json
// package.json
"@cent/reglas": "github:simonmareyna/cent-reglas"
```

No hay paso de build a propósito. Publicar un `dist/` obligaría a recordar reconstruir y
commitear en cada cambio — un nuevo modo de desincronización silenciosa, justo lo que este
paquete busca eliminar.

## Reglas para escribir aquí

1. **Solo funciones puras.** Nada de Supabase, `fetch` ni variables de entorno. Las
   consultas se quedan en cada app; aquí vive la decisión, no la obtención de datos.
2. **Sin dependencias.** Ninguno de los tres módulos importa nada.
3. **Salida JSON-serializable**: números, strings, booleanos, null, arreglos y objetos
   planos. Nunca una función. El portal pasa estos resultados de un Server Component a un
   Client Component, y una función en las props tumba la página en producción con
   "Application error" — sin que `tsc` ni el build lo detecten.
4. **Nada de `for...of` sobre `Set`/`Map`.** El tsconfig de `cent-operation-system` usa
   `target: es5` sin `downlevelIteration`. Usar `Array.from()` y `.filter()`.

## Cómo cambiar una regla

1. Cambiar aquí y hacer push.
2. **Actualizar la dependencia en LOS DOS repos**, en el mismo movimiento.

El segundo paso no es opcional: `package-lock.json` fija el SHA del commit **por repo**,
así que actualizar uno solo los deja en versiones distintas de la regla — el mismo problema
que este paquete resuelve, solo que más lento y más difícil de ver.

`npm run verify` en cualquiera de los dos repos falla si las versiones instaladas no
coinciden.
