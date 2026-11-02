# Notifiche: funzionamento e gestione dal CMS

Questa guida descrive la nuova gestione delle notifiche interne alla webapp.
È riferita al codice presente in questo progetto: un aggiornamento della
documentazione su GitHub non pubblica automaticamente l'app e non importa dati.

## 1. Cosa vede l'utente

- Una campanella apre la pagina Notifiche; il badge indica quante notifiche
  visibili non sono state lette, con `9+` oltre nove.
- Ogni scheda contiene messaggio, data relativa e stato di lettura.
- Aprire una notifica la segna come letta prima di raggiungere il collegamento.
- **Segna tutte come lette** aggiorna insieme le notifiche visibili.
- Le letture sono associate al profilo, non soltanto al browser: restano disponibili
  nelle sessioni successive. Non vengono creati profili se il record utente manca.
- I messaggi seguono la lingua IT, EN o BN scelta nell'app. Se manca la traduzione
  richiesta viene usato l'italiano.

Non sono inviate notifiche push, SMS o email. L'utente deve entrare nella webapp.
Il caricamento avviene dopo il login, al cambio lingua e ogni dieci minuti.

## 2. Accedere alla gestione

1. Accedere come amministratore al CMS.
2. Aprire **Notifiche** dal selettore delle sezioni.
3. Controllare lo stato di visibilità della sezione, sopra il calendario.

| Visibilità sezione | Chi può accedere |
|---|---|
| Interna | Amministratori |
| Anteprima | Amministratori e utenti `fincantieri_users` |
| Pubblicata | Anche utenti standard |

Questa scelta riguarda tutta la sezione. Il comando **Attiva** di una singola
notifica riguarda invece solo quella notifica: non rende pubblica la sezione.
Le API applicano gli stessi controlli, non soltanto l'interfaccia.

## 3. Creare una notifica

1. Premere **Nuova notifica**.
2. Controllare l'ID: deve identificare stabilmente una sola notifica. Dopo la
   creazione non è modificabile nell'editor.
3. Selezionare obiettivo e tipo:
   - `content_engagement`: invita a consultare un contenuto; richiede una guida.
   - `function_engagement`: invita a usare una funzionalità.
   - `welcome`: messaggio di benvenuto, incluso `N-WELCOME`.
4. Per un contenuto selezionare la guida: ID guida, ID contenuto e collegamento
   vengono compilati automaticamente. La guida deve esistere nel CMS italiano
   delle bozze.
5. Compilare il messaggio italiano, obbligatorio, e possibilmente EN e BN.
6. Impostare data iniziale, data finale e territorio.
7. Controllare frequenza, stato data e aggancio editoriale; scegliere se attivarla.
8. Consultare l'anteprima e premere **Salva**.

I messaggi oltre 180 caratteri sono segnalati, ma non bloccati.
I collegamenti devono essere percorsi interni (`/...`) o URL HTTPS.
La data finale non può precedere quella iniziale.

**Importante:** `welcome` non introduce un invio automatico al primo accesso.
Anche questo tipo segue le normali regole di data, territorio e visibilità.
La frequenza è un metadato: `annuale` non sposta automaticamente le date negli
anni successivi e non genera invii. Per riutilizzare il calendario occorre
aggiornare le date.

## 4. Modificare, disattivare o eliminare

- In **Elenco**, filtrare per mese, stato attivo o traduzioni mancanti.
- Aprire una notifica per modificarla e salvare.
- Usare l'interruttore per attivare/disattivare: il cambiamento è salvato subito.
- In **Calendario**, cambiare mese e selezionare una notifica per aprire l'editor.
- Per eliminare, usare il comando dedicato e confermare. L'eliminazione non
  dispone di un pulsante di annullamento; la versione precedente viene archiviata
  su S3 prima della scrittura.

Disattivare è preferibile quando si vuole sospendere una notifica mantenendola
nel calendario. L'importazione di un file senza una certa notifica **non la elimina**.

## 5. Importare il calendario Excel

1. Premere **Importa da Excel** e selezionare un file `.xlsx`.
2. Attendere l'anteprima: questa fase non salva nulla.
3. Controllare righe nuove, aggiornate, saltate, errori e avvisi.
4. Se ci sono errori, correggere il file e caricarlo nuovamente.
5. Premere **Conferma import** soltanto dopo aver verificato il risultato.

Sono accettati file fino a 5 MB e fino a 5000 righe. Il foglio usato è
`Calendario`, se presente, altrimenti il primo. Le intestazioni determinano i
campi: spostare le colonne non cambia l'importazione.

| Dato | Colonna Excel |
|---|---|
| Identificativo stabile | `id_notifica` |
| Obiettivo e tipo | `obiettivo`, `tipo_notifica` |
| Contenuto, guida e collegamento | `ID contenuto`, `ID guida CMS`, `pagina` |
| Periodo | `data_pubblicazione`, `data_fine` |
| Frequenza e attivazione | `frequenza`, `notifica_attiva` |
| Territorio | `territorio` |
| Testi | `Messaggio IT`, `Messaggio EN`, `Messaggio BN` |
| Informazioni editoriali | `Aggancio (perché quella data)`, `Stato data` |

### Regole da conoscere

- Lo stesso ID aggiorna il record; un ID nuovo crea una notifica. I record non
  presenti nell'Excel restano invariati.
- Le colonne `Messaggio IT proposto`, `Aggancio proposto` e `Stato data proposto`,
  se compilate, prevalgono sui valori originali.
- `Approvazione = Da eliminare` salta la riga con un avviso: non cancella
  eventuali record già salvati.
- Le altre colonne non utilizzate vengono ignorate.
- Sono supportate date Excel e date testuali `GG/MM/AAAA`. Senza data finale
  viene usata la data iniziale più 14 giorni.
- Le formule sono lette solo se il file contiene già il risultato calcolato:
  il server non esegue le formule.
- `VERO`, `TRUE`, `Sì` e `1` indicano una notifica attiva.
- Gli errori bloccano la conferma, ad esempio ID duplicati, guide inesistenti,
  date o campi obbligatori non validi.
- Gli avvisi non bloccano: traduzioni mancanti, italiano oltre 180 caratteri,
  date passate e più di due notifiche nella settimana lunedì–domenica.

Il calendario V3 verificato contiene **45 notifiche**: 44 programmate e
`N-WELCOME`. Caricare il file per una verifica non lo importa automaticamente
nel bucket operativo.

## 6. Esportare e lavorare fuori dal CMS

Premere **Esporta Excel** per scaricare il calendario corrente.
Modificare il file mantenendo gli ID, quindi seguire il percorso di importazione.
Una reimportazione senza cambiamenti non riscrive configurazione, audit o archivio.
Per eliminare un record esistente usare il CMS, non rimuovere soltanto la riga.

## 7. Quando una notifica è visibile

Devono essere soddisfatte tutte queste condizioni:

1. La sezione è accessibile per il ruolo dell'utente.
2. La notifica è attiva.
3. Il giorno corrente è compreso tra inizio e fine, estremi inclusi, nel fuso
   **Europe/Rome**.
4. Il territorio è `Tutti`, oppure coincide con `sede` del profilo DynamoDB
   (`Marghera` o `Monfalcone`, senza distinzione maiuscole/minuscole).

Un profilo senza sede vede soltanto il territorio `Tutti`.
Lo stato editoriale della data non sostituisce queste regole.
Le notifiche sono ordinate dalla data iniziale più recente.
Una notifica letta rimane nell'elenco quando ancora visibile, ma non nel conteggio
delle non lette.

## 8. Se qualcosa non compare

| Problema | Controlli |
|---|---|
| Campanella o sezione assente | Login e visibilità Interna/Anteprima/Pubblicata rispetto al ruolo |
| Notifica assente | Interruttore attivo, periodo inclusivo, territorio e sede del profilo |
| Testo italiano con lingua EN/BN | Traduzione mancante: compilare il testo della lingua nel CMS |
| Nessuna notifica dopo aver scelto l'Excel | L'anteprima non salva: completare **Conferma import** |
| Conferma disabilitata | Risolvere gli errori e verificare che esistano righe importabili |
| Una riga rimane dopo il reimport | L'import unisce per ID e non elimina i record mancanti |
| Letture non persistenti | Verificare che esista il profilo e che DynamoDB consenta lettura/aggiornamento |
| Errore durante il salvataggio | Verificare permessi S3 su configurazione e archivio; un archivio fallito blocca il salvataggio |

## 9. Note tecniche per i manutentori

- Configurazione: `config/notifications.json` su S3; l'assenza del file equivale
  a un calendario vuoto. Non occorre crearlo manualmente.
- Prima di ogni modifica effettiva, la versione precedente viene copiata in
  `config/archive/notifications_<timestamp>.json`.
- Audit: `updatedAt` e `updatedBy`.
- Letture: attributo `notificationsRead` nel profilo DynamoDB esistente,
  identificato dal telefono verificato; chiave del record `userId`.
  Si mantengono al massimo gli ultimi 300 ID, con gestione dei conflitti.
- Le API utente accettano sessioni Cognito e sessioni firmate preview/codice
  personale; le API CMS richiedono il token amministrativo.
- La policy di riferimento nel progetto è `infra/notifications-iam.yaml`.
  Le modifiche IAM non vengono applicate automaticamente.
- Per l'elenco degli endpoint e i comandi di test, vedere
  [Calendario notifiche e letture personali nel README](../README.md#calendario-notifiche-e-letture-personali).
