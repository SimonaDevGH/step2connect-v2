# Gestire quiz e badge dal CMS

Questa guida è rivolta a chi aggiorna i contenuti di Step2Connect.
Non serve modificare codice o accedere direttamente ad AWS.

## 1. Accedere alla sezione

Accedi a `/admin/login` con il tuo account CMS, quindi scegli **Quiz**.
L’account CMS è distinto dall’accesso telefonico della webapp.
La sezione contiene due schede: **Quiz** e **Badge**.

## 2. Importare quiz da Excel

1. In **Quiz**, scegli **Importa da Excel** e seleziona un file `.xlsx`.
2. Premi **Anteprima import**.
3. Controlla gli elementi nuovi o aggiornati e gli errori o avvisi.
   L’anteprima non salva e non pubblica nulla.
4. Correggi gli errori nel file e ripeti l’anteprima, se necessario.
5. Premi **Conferma import**.

I nuovi quiz vengono salvati **in bozza, con visibilità Interno**.
Per quelli già presenti viene conservata la visibilità precedente.
L’importazione non aggiorna automaticamente le versioni online.

Il file può contenere affermazioni e spiegazioni in italiano, inglese e bengalese.
Il foglio preferito è **Quiz 3 lingue**; in sua assenza viene letto il primo.
Sono accettati file fino a 5 MB e un massimo di 5000 righe.

### Le colonne principali

| Colonna | Cosa inserire |
|---|---|
| ID contenuto | Riferimento del contenuto, mantenendo eventuali zeri iniziali |
| ID guida CMS | Identificativo esatto della guida già presente nel CMS |
| Domanda | Identificativo stabile della domanda, per esempio `q1` |
| Risposta | `Vero` oppure `Falso` |
| Paragrafo | Ancora della guida, per esempio `p5` |
| Affermazione IT / EN / BN | Testo della domanda nelle tre lingue |
| Spiegazione IT / EN / BN | Spiegazione della risposta nelle tre lingue |

Il titolo e la categoria del quiz derivano dalla guida CMS, non dal titolo
eventualmente presente nell’Excel. Ogni guida ha un solo quiz con identificativo
`quiz-<ID guida>`. Italiano obbligatorio; traduzioni mancanti producono avvisi.
Le intestazioni esatte riconosciute sono riportate nella
[sezione tecnica del README](../README.md#excel-e-dati).
**Esporta Excel** permette di partire dal formato corrente prima di modificarlo.

## 3. Modificare un quiz

Apri **Modifica** sulla riga del quiz. Puoi:

- inserire o correggere affermazioni e spiegazioni IT/EN/BN;
- scegliere Vero/Falso e il paragrafo collegato per ciascuna domanda;
- aggiungere, eliminare e riordinare domande;
- impostare la soglia di superamento;
- indicare URL audio distinti per lingua, dove disponibili.

La guida associata è mostrata con un collegamento. Il menu paragrafi aiuta
a riconoscere il testo italiano collegato.
Un contatore arancione segnala testi lunghi: è un avviso, non un blocco.
**Salva bozza** conserva le modifiche senza renderle disponibili agli utenti.

## 4. Pubblicare o ritirare uno o più quiz

Per un singolo quiz usa **Pubblica modifiche**.
Per più quiz seleziona le caselle delle righe oppure **Seleziona tutti**, poi:

- **Pubblica selezionati**: rende online le bozze nelle tre lingue;
- **Riporta in bozza**: rimuove le versioni online nelle tre lingue, conservando
  le bozze, la visibilità e i risultati degli utenti.

Controlla il riepilogo e conferma. Durante l’operazione viene mostrato
l’avanzamento. Se alcuni aggiornamenti falliscono, gli elementi non riusciti
restano selezionati per poter riprovare. Cambiare lingua azzera la selezione.

### Stato e visibilità non sono la stessa cosa

Un quiz **Online** può essere ancora riservato agli amministratori:

| Visibilità | Chi può giocare un quiz online |
|---|---|
| Interno | Amministratori dell’app |
| Anteprima | Amministratori e utenti Fincantieri/ELIS autorizzati |
| Pubblicato | Tutti gli utenti autenticati autorizzati alla sezione |

Anche la visibilità generale della sezione Quiz deve consentire l’accesso.
Per provare un nuovo quiz come admin: pubblicalo lasciandolo **Interno**.
Un quiz solo in bozza non è giocabile, nemmeno dagli amministratori nell’app.
Scegliere una visibilità sulla riga pubblica l’ultima bozza: non usarlo per
preparare in anticipo contenuti ancora da controllare.

## 5. Cosa vedono gli utenti

Nella webapp, **Quiz** mostra le categorie delle guide con almeno un quiz
disponibile. Ogni domanda offre due risposte grandi, Vero e Falso, seguite
dalla spiegazione. Il collegamento alla guida evidenzia il paragrafo e consente
di tornare alla domanda in corso.

Il risultato finale mostra stelle e superamento. Il server calcola il punteggio;
il profilo conserva il primo tentativo, il miglior risultato e i tentativi.
I risultati non dipendono soltanto dalla memoria del browser.

## 6. Gestire “I miei badge”

In **CMS → Quiz → Badge** sono presenti sei definizioni:

1. Esperto burocrate — Documenti e permessi.
2. Pronto all’emergenza — Salute e pronto soccorso.
3. Casa in regola — Casa e bollette.
4. Genitore a pieni voti — Scuola e famiglia.
5. Di casa in città — Vivere in città.
6. Campione Step2Connect — completamento delle categorie disponibili.

Puoi cambiare emoji e titoli IT/EN/BN. Le modifiche vengono salvate
automaticamente: attendi **Salvato** prima di lasciare il pannello.
Se appare un errore, correggi i campi indicati o premi **Riprova**.
L’anteprima mostra l’aspetto della definizione mentre scrivi.
ID, categorie e regole di sblocco non sono modificabili dal pannello.

### Quando si ottiene un badge?

- Categoria: tutti i quiz pubblicati e visibili all’utente in quella categoria
  devono essere superati; deve esserci almeno un quiz.
- Campione: occorrono tutti i badge delle categorie con almeno un quiz visibile.
- Nessun quiz disponibile non equivale a un completamento.
- Una volta ottenuto, **il badge non si perde**, anche aggiungendo nuovi quiz.
  La prima data di conquista resta conservata.

L’utente apre **Quiz → I miei badge**, oppure `/quiz/badges`.
Le card colorate indicano conquiste; quelle grigie mostrano il progresso,
per esempio “1 di 9 quiz superati”. Toccando una conquista si apre il dettaglio.
A fine quiz i nuovi badge sono annunciati con un’animazione.
Le modifiche ai titoli dal CMS compaiono al successivo caricamento della raccolta.

## 7. Leggere le statistiche

Apri un quiz e scegli **Statistiche**. Sono disponibili:

- numero di persone che hanno tentato il quiz;
- percentuale di persone che lo hanno superato almeno una volta;
- percentuale di risposte corrette al primo tentativo per domanda.

Una domanda sotto il 60% è evidenziata in rosso per aiutare a rivederne il testo
o la guida collegata. `N/D` significa che non ci sono ancora risposte iniziali.
Il pannello non mostra nomi, telefoni o risultati individuali.

## 8. Problemi frequenti

| Problema | Controllo da fare |
|---|---|
| Non vedo un quiz nella webapp | Esiste una versione online? Sezione e quiz sono visibili al mio ruolo? |
| Dopo l’importazione il quiz non cambia | L’import aggiorna le bozze: pubblica le modifiche |
| Il badge è ancora grigio | Devono essere superati tutti i quiz visibili della categoria |
| Il titolo non è aggiornato | Attendi “Salvato” nel CMS, poi ricarica la pagina utente |
| Una lingua mostra italiano | Completa le traduzioni e pubblica il quiz |
| Importazione bloccata | Leggi gli errori dell’anteprima: guida, identificativi, risposte e campi obbligatori |

Aggiornare GitHub conserva il codice; pubblicare l’app aggiorna il sito.
I contenuti CMS e i dati personali sono conservati separatamente su AWS e non
vengono inseriti nel repository.
