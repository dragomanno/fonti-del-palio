# Report font subsetting — Latin / Latin Extended

Verifica eseguita nell'ambito della diagnostica v3 (controlli scaffold secondari).

## Situazione attuale

Il progetto usa `@fontsource/fraunces`, `@fontsource/inter` e `@fontsource/jetbrains-mono`
(v5.3.0), importati per singolo peso in `src/layouts/BaseLayout.astro`:

```js
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
```

**@fontsource genera automaticamente file CSS per singolo subset** (`latin`,
`latin-ext`, `cyrillic`, `vietnamese`, ecc.), ciascuno con il proprio
`unicode-range` e file `.woff2` dedicato. Importando `fraunces/500.css` (senza
suffisso di subset) si ottengono **tutti** i blocchi `@font-face` per quel
peso, uno per subset, ciascuno con `unicode-range` — il browser scarica solo
il file `.woff2` del subset richiesto dal testo reale della pagina grazie al
meccanismo nativo `unicode-range`. In pratica il sito e' **gia' effettivamente
subsettato lato browser**, anche senza costruire un file CSS "solo latin"
manuale.

## Verifica di copertura dei caratteri italiani

Il subset `latin` di ciascun font copre `U+0000-00FF` (Latin-1 Supplement),
che include tutte le vocali accentate usate nei contenuti italiani del
progetto (à `U+00E0`, è `U+00E8`, é `U+00E9`, ì `U+00EC`, ò `U+00F2`, ù
`U+00F9`) — confermato leggendo `unicode-range` nel CSS generato e
verificando la presenza di questi caratteri nei 4 file KB canonici.

Il subset `latin-ext` (blocchi `U+0100-017F` e oltre — es. ő, œ ligato,
caratteri dell'Europa centro-orientale) **non e' necessario per l'italiano**
e non viene mai caricato dal browser per queste pagine, perche' nessun
carattere del contenuto cade nel suo `unicode-range`.

## Dimensione dei file effettivamente scaricati (subset latin, per peso)

| Font              | Peso | Dimensione woff2 |
|-------------------|------|-------------------|
| Fraunces          | 500  | 20 KB             |
| Fraunces          | 600  | 20 KB             |
| Fraunces          | 700  | 20 KB             |
| Inter             | 400  | 24 KB             |
| Inter             | 500  | 24 KB             |
| Inter             | 600  | 24 KB             |
| JetBrains Mono    | 400  | 24 KB             |
| JetBrains Mono    | 500  | 24 KB             |

Totale scaricato per una pagina che usa tutti i pesi: ~180 KB, self-hosted,
nessuna richiesta di rete a Google Fonts o CDN esterni.

## Conclusione

Nessuna modifica necessaria. Il subsetting Latin richiesto dai controlli
secondari e' **gia' in vigore** grazie al comportamento predefinito di
@fontsource: ogni import carica solo il blocco `@font-face` del subset che
il `unicode-range` rende effettivamente scaricabile, e il subset `latin`
copre pienamente il set di caratteri usato dai contenuti italiani del sito.
Non e' stato quindi prodotto un "build-size diff report" comparativo, perche'
non esiste una configurazione "prima" piu' pesante da confrontare: l'assetto
attuale e' gia' lo stato subsettato.
