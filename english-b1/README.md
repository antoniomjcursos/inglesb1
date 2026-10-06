# Cuaderno de inglés B1

Vocabulario y gramática de inglés para preparar el B1. Cada palabra tiene imagen, pronunciación oficial (AFI, inglés británico), pronunciación «a la española», traducción y audio. La gramática tiene explicación, estructura, ejemplos con audio y errores típicos.

Todo el contenido está en archivos JSON dentro de `data/`. Para añadir un tema nuevo no hace falta tocar el código.

La web tiene una portada con todos los temas, un menú **Vocabulario** y otro **Gramática** con cada tema, un buscador que busca en todo el vocabulario y, dentro de cada tema, un índice de secciones y un modo repaso que oculta el español.

## Ver la web

- **En internet:** activa GitHub Pages (ver más abajo) y entra en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.
- **En tu ordenador:** abre una terminal en la carpeta del proyecto y ejecuta
  ```
  python3 -m http.server
  ```
  Después entra en <http://localhost:8000>. Abrir `index.html` con doble clic **no funciona**, porque el navegador no deja leer los JSON desde el disco.

### Publicar con GitHub Pages

1. Sube el proyecto a un repositorio de GitHub.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)` y pulsa **Save**. En uno o dos minutos la web estará en la dirección que te indique.

Cualquiera puede verla sin cuenta.

## Estructura

```
index.html              la página
assets/app.js           la lógica (carga y muestra los JSON)
assets/app.css          el diseño
data/index.json         la lista de temas, en el orden en que aparecen
data/vocabulary/*.json  un archivo por tema de vocabulario
data/grammar/*.json     un archivo por tema de gramática
data/_plantillas/       plantillas para copiar
icons/                  las imágenes (SVG)
scripts/validate.py     comprueba que los JSON están bien
scripts/add_icon.py     descarga iconos nuevos
```

## Añadir un tema nuevo

1. Copia `data/_plantillas/vocabulario.json` (o `gramatica.json`) a `data/vocabulary/` (o `data/grammar/`).
2. Cambia el nombre del archivo: tiene que ser igual que su `"id"`, en minúsculas y con guiones. Por ejemplo, `"id": "travel"` → `travel.json`.
3. Rellénalo.
4. Añádelo a `data/index.json`:
   ```json
   "units": [
     "vocabulary/food-and-cooking.json",
     "vocabulary/travel.json"
   ]
   ```
5. Comprueba que está bien con `python3 scripts/validate.py`.

### Datos de cada tema

| Campo | ¿Obligatorio? | Qué es |
|---|---|---|
| `id` | sí | Nombre interno, en minúsculas y con guiones. Igual que el nombre del archivo. No uses `inicio`, `vocabulario` ni `gramatica`. |
| `type` | sí | `"vocabulary"` o `"grammar"`. Decide en qué menú aparece. |
| `title` / `title_es` | `title` sí | Título en inglés y en español. El español es el que se ve en menús y tarjetas. |
| `icon` | no | Icono del tema en el menú, en la portada y en la cabecera del tema. Si falta, se usa el de la primera palabra. |
| `level` | recomendado | A1, A2, B1, B2, C1 o C2. |
| `description` | no | Una frase que se ve en la tarjeta de la portada. |
| `sections` | sí | Lista de secciones. Cada una lleva `id`, `title`, `title_es` y sus `items` (vocabulario) o su explicación (gramática). |

El orden de `data/index.json` es el orden de los menús y de la portada.

Para **completar un tema que ya existe**, abre su JSON y añade palabras a la lista `"items"` de la sección que quieras, o crea una sección nueva en `"sections"`.

## Formato de una palabra

```json
{
  "en": "aubergine",
  "ipa": "ˈəʊ.bə.ʒiːn",
  "pron": "ÓUbazhiin",
  "es": "berenjena",
  "icon": "eggplant",
  "note": "EE. UU.: *eggplant*.",
  "example": "I love grilled aubergine.",
  "example_es": "Me encanta la berenjena a la plancha."
}
```

| Campo | ¿Obligatorio? | Qué es |
|---|---|---|
| `en` | sí | La palabra o expresión en inglés. |
| `ipa` | sí | Pronunciación AFI **sin** barras (la página las pone). Cópiala del [Cambridge Dictionary](https://dictionary.cambridge.org/es/), versión UK. |
| `pron` | sí | Pronunciación a la española, con la **sílaba fuerte en MAYÚSCULAS**. Ver las reglas abajo. |
| `es` | sí | Traducción. |
| `icon` | no | Nombre de un archivo de `icons/` sin `.svg`. Si no hay icono, sale la inicial de la palabra. |
| `note` | no | Nota: diferencias UK/US, falsos amigos, plurales… |
| `example` / `example_es` | no | Frase de ejemplo (con audio) y su traducción. |
| `say` | no | Texto que lee el audio, si es distinto de `en`. |

En `note`, `example` y `es` puedes usar `*cursiva*` y `**negrita**`. No se admite HTML. Si en una nota escribes una pronunciación entre comillas latinas con la sílaba fuerte en mayúsculas, como «CHÓK-lat», se resalta igual que en la columna de pronunciación.

### Reglas de la pronunciación a la española (`pron`)

| Escribe | Significa | Ejemplo |
|---|---|---|
| MAYÚSCULAS | sílaba fuerte (en palabras de una sílaba no hace falta) | lobster → `LÓBsta` |
| vocal doble: ii, uu, aa, oo | vocal larga | beef → `bíif` |
| zz | «s» que zumba, como una abeja (/z/) | cheese → `chíizz` |
| z | nuestra «z» de «zapato» (/θ/) | healthy → `JÉLzi` |
| y | la «y» fuerte de «¡yo!» (/dʒ/) | ginger → `YÍNya` |
| zh | la «ll» argentina de «yo» (/ʒ/) | aubergine → `ÓUbazhiin` |
| j | «h» aspirada suave (/h/) | honey → `JÁni` |
| sh | «chsss» (/ʃ/) | fish → `fish` |
| d | «d» suave de «nada» (/ð/) | the → `da` |

## Formato de una sección de gramática

```json
{
  "id": "should",
  "title": "should / shouldn't",
  "title_es": "Deberías / no deberías",
  "use": "Para dar **consejos**.",
  "forms": [{ "label": "Afirmativa", "pattern": "sujeto + should + infinitivo", "example": "You should eat more fruit." }],
  "keywords": ["should", "shouldn't"],
  "examples": [{ "en": "You should cut down on fats.", "es": "Deberías tomar menos grasas." }],
  "mistakes": [{ "wrong": "You should to eat more fruit.", "right": "You should eat more fruit.", "why": "Después de *should* nunca va *to*." }]
}
```

Otros apartados opcionales de una sección de gramática:

| Campo | Qué es |
|---|---|
| `tables` | Tablas: `[{ "title": "…", "head": ["Col 1", "Col 2"], "rows": [["a", "b"], ["c", "d"]], "note": "…" }]`. Todas las filas deben tener tantas columnas como `head`. |
| `exceptions` | Lista de excepciones (recuadro naranja): `["…", "…"]`. |
| `tips` | Lista de trucos y recordatorios: `["…", "…"]`. |
| `practice` | Ejercicios con la respuesta oculta: `[{ "q": "She ___ (eat) fish.", "a": "eats", "why": "opcional" }]`. Escribe el hueco con `___`. |

En todos los textos puedes usar `*cursiva*` y `**negrita**`.

Todos los apartados son opcionales, pero cada sección necesita al menos uno de `use`, `forms`, `tables`, `examples` o `mistakes`.

## Iconos

Los iconos son [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) de Microsoft (licencia MIT, ver `icons/LICENSE-fluent-emoji.txt`). Los que empiezan por `x-` son dibujos propios.

Para añadir uno:

```
python3 scripts/add_icon.py --buscar cake     # ver qué nombres hay
python3 scripts/add_icon.py birthday-cake     # descargarlo a icons/
```

También puedes poner cualquier SVG propio en `icons/`, con `viewBox="0 0 32 32"`.

## Comprobación automática

Cada vez que subes cambios, GitHub Actions ejecuta `scripts/validate.py` (pestaña **Actions**). Si algo está mal, como un campo obligatorio que falta, un icono que no existe, un JSON con una coma de más o HTML en un texto, aparece una cruz roja con el archivo, la sección y la palabra exactas.

## Derechos de autor

No subas fotos ni escaneos del libro de texto ni de los apuntes: tienen derechos de autor o datos personales (el `.gitignore` ya excluye PDF y JPG). Las listas de palabras, la pronunciación y las explicaciones escritas por ti sí se pueden publicar.

## Licencia

Código y contenido: MIT © 2026 Antonio M. Martín. Iconos de terceros: ver `icons/LICENSE-fluent-emoji.txt`.
