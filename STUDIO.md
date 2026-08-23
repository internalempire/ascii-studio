# ASCII Studio

Interfaccia locale per il progetto **webgl-ascii-hero**: carichi un modello 3D, regoli ogni
parametro dello shader vedendo il risultato in tempo reale, e generi una GIF (o un video) della
rotazione a 360° su uno o più assi.

Lo studio vive su `/`. La pagina hero originale del progetto resta intatta su `/hero`.

```bash
npm install
npm run dev
```

Poi apri <http://localhost:3000>.

---

## Come è fatta l'interfaccia

| Zona | Cosa contiene |
| --- | --- |
| Colonna sinistra | La scena: modello, posa, camera, animazione, luci, materiale |
| Centro | Il viewport, che mostra **esattamente** il fotogramma che verrà esportato |
| Colonna destra | La resa: uscita, ASCII, sfondo, effetti — e in basso il pulsante di render |
| Barra in basso | Griglia di caratteri, dimensione cella, set attivo, fps, zoom |

Il viewport non è un'anteprima approssimativa: il canvas viene renderizzato alla risoluzione di
uscita esatta, a `devicePixelRatio` 1. La griglia ASCII dipende dai pixel, quindi è l'unico modo
perché quello che vedi sia quello che esporti. I segni di taglio agli angoli delimitano il
fotogramma finale; sotto trovi dimensione e livello di zoom.

- **Trascina** sul viewport per orbitare, **rotella** per avvicinarti.
- Il pulsante zoom in basso a destra alterna *adatta* e *1:1*.
- Ogni cursore accetta un valore digitato, e **doppio clic sull'etichetta** riporta il parametro al
  valore iniziale.

---

## Caricare un modello

Tre strade:

1. **Trascina un `.glb`** direttamente sul viewport, o usa `Carica .glb / .gltf`.
2. **`.gltf` con file esterni**: selezionali tutti insieme (`.gltf` + `.bin` + le texture). Lo
   studio li tiene in memoria e riscrive i percorsi interni del file, quindi non serve un server.
3. **Primitive di prova** (nodo toroidale, toro, icosaedro, cubo, sfera, cono) per provare una resa
   senza avere un modello a portata di mano.

I modelli compressi **Draco** e **Meshopt** funzionano offline: il decoder Draco è copiato in
`public/draco/`.

Ogni modello viene misurato e centrato sul proprio ingombro, così la rotazione avviene attorno al
suo baricentro e non attorno all'origine del file — è la differenza fra un giro pulito e un modello
che ondeggia fuori campo. Il fattore di adattamento è indicato sotto il pannello (`fit ×…`); da lì
in poi *Scala* e gli *Offset* sono tuoi.

Se il modello contiene clip di animazione compare la sezione **Animazione**: puoi scegliere la clip
e quante volte deve ripetersi dentro il loop. In export la clip viene campionata a tempo assoluto,
quindi si richiude esatta come la rotazione.

---

## I due parametri che cambiano tutto

Lo shader non colora il modello: ne legge la **luminanza** e la traduce in caratteri più o meno
densi. Da qui due conseguenze poco intuitive:

**1. Il materiale deve stare sui toni medi.** Con `Inverti luminanza` attivo (l'impostazione
originale) le zone chiare della scena restano vuote e i caratteri si addensano nelle ombre. Un
materiale bianco puro manda quasi tutto in bianco e il disegno si svuota: sulla scena demo un
materiale `#ffffff` copre lo 0,6% del fotogramma, un grigio medio `#808080` il 6,6%. Il colore
finale dei caratteri lo decide comunque **Tinta**, non il materiale.

**2. Il rapporto della cella decide se sembra un terminale.** *Altezza cella* è il passo verticale
della griglia; *Rapporto cella* è quanto è larga rispetto all'altezza. A `1.00` la griglia è
quadrata come nel componente originale, e i glifi monospace — che sono più stretti che alti —
lasciano spazio attorno a sé: la resa è rada e puntinata. Intorno a `0.55` la cella prende le
proporzioni di un carattere vero e il disegno si chiude, con la densità dell'arte ASCII classica.
L'atlante dei glifi viene ricostruito con lo stesso rapporto, quindi i caratteri non si deformano
mai.

Gli altri controlli utili quando il risultato non convince: *Contrasto* (allarga la gamma prima
della conversione), *Soglia inchiostro* (quanto poco basta perché una cella venga disegnata),
*Taglio sfondo* (sotto quale luminanza una cella è considerata fondo vuoto) e *Guadagno volume*
(quanto marcato è il passaggio fra glifi radi e densi, cioè quanto il disegno sembra tridimensionale).

---

## Generare la GIF

Nella sezione **Uscita**:

- **Larghezza / Altezza** — anche da preset rapidi. `Allinea alla griglia di celle` arrotonda le
  due misure a un multiplo esatto della cella, così non restano celle tagliate ai bordi.
- **Fotogrammi** e **Fotogrammi al secondo** — la durata del loop è mostrata sopra il pulsante di
  render. La GIF misura i tempi in centesimi di secondo: se il valore scelto non è rappresentabile,
  lo studio ti dice a quale fps reale corrisponde invece di fingere.
- **Giri per asse** — quanti giri completi compie il modello su X, Y e Z nell'arco del loop. Valori
  interi su più assi si richiudono sempre; un valore negativo inverte il senso. L'anteprima ruota
  sugli stessi assi, quindi è una prova generale del risultato.
- **Colori nella palette** — la GIF usa una sola palette per tutta l'animazione, campionata su più
  fotogrammi. Una palette globale evita lo sfarfallio dei colori fra un fotogramma e l'altro e
  produce file più piccoli.

Durante il render il viewport resta visibile e vedi il loop essere scattato fotogramma per
fotogramma, con contatore e possibilità di annullare. A fine lavoro il risultato si apre a
dimensione reale, con peso del file, download e apertura in una scheda.

### Sfondo trasparente

Attiva **Sfondo → Trasparente**: lo shader restituisce il canale alpha ricavato dalla copertura dei
glifi, e la GIF usa la trasparenza a 1 bit (con disposal corretto fra i fotogrammi). Utile per
appoggiare l'animazione su una pagina senza rettangolo nero attorno. Il bordo dei caratteri diventa
netto, perché la GIF non ha alpha intermedi.

### Video

Con formato **Video** lo studio usa **WebCodecs** (VP9 in un contenitore WebM): ogni fotogramma
viene marcato con il proprio istante esatto, quindi la cadenza è perfettamente regolare e la
codifica non deve avvenire in tempo reale. Sui browser senza WebCodecs si ripiega su
`MediaRecorder`, che campiona a orologio reale: in quel caso il render dura quanto il loop.

Il video non trasporta trasparenza: se lo sfondo è impostato su trasparente, il video userà
comunque il colore di sfondo scelto.

---

## Preset, salvataggi, codice

- **Preset**: sette rese di partenza (Hero purple, Green phosphor, Amber CRT, Katakana rain,
  Blueprint, Xerox, Malfunction). Applicano solo l'aspetto: modello, camera e impostazioni di
  uscita restano come li hai lasciati.
- **Salva / Apri**: esporta e reimporta tutti i parametri come JSON. I parametri correnti sono
  comunque conservati nel browser fra una sessione e l'altra; **Reset** riporta tutto ai valori
  iniziali.
- **Copia JSX**: mette negli appunti la configurazione già formattata per il componente originale
  (`components/effect-scene.tsx`) — costanti di camera, materiale, luci e il blocco `<AsciiEffect>`
  con i soli post-effetti attivi. È il modo per far finire una sessione di studio dentro il tuo
  codice invece che in uno screenshot.

---

## Limiti da conoscere

- **Tieni la scheda in primo piano durante l'export.** I browser sospendono l'animazione nelle
  schede in secondo piano: il render si fermerebbe. Se succede, lo studio te lo dice esplicitamente
  invece di restare appeso.
- **Memoria**: la GIF tiene in RAM tutti i fotogrammi prima di codificarli. Sopra i 500 MB stimati
  compare un avviso; alle risoluzioni alte conviene il formato video.
- Il rapporto cella non esiste nel componente originale, che ha celle quadrate: quando è diverso da
  `1.00` il codice JSX copiato lo segnala.

---

## Dove sta il codice

```
app/page.tsx                          → lo studio
app/hero/page.tsx                     → la pagina hero originale
components/studio/
  studio.tsx                          stato, intestazione, disposizione
  scene.tsx                           canvas R3F, luci, camera, lettura dei fotogrammi
  model.tsx                           caricamento, adattamento, materiali, animazioni
  ascii-effect-studio.tsx             shader e atlante dei glifi, uniform aggiornabili a caldo
  panels.tsx · ui.tsx                 pannelli e controlli
  viewport.tsx · export-panel.tsx     inquadratura, avanzamento, risultato
lib/studio/
  settings.ts                         parametri, preset, set di caratteri
  capture.ts                          sincronia fra ciclo di render ed export
  export-run.ts                       la sequenza di cattura
  gif.ts · video.ts                   codifica GIF e video
  code-snippet.ts                     generazione del JSX
```

Il cuore della precisione sta in `capture.ts`: l'esportatore fissa una posa e attende **quel**
fotogramma composito, non uno qualsiasi. Una callback applica la posa prima del composer, un'altra
legge il canvas dopo — così ogni fotogramma della GIF corrisponde all'angolo esatto che gli spetta.
