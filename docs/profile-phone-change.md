# Profilo e cambio del numero di telefono

## Cosa può fare l'utente

Dal pulsante Profilo, sempre evidenziato nelle rotte `/profile*`, può consultare
i propri dati, aprire i badge se il quiz è visibile e uscire. L'uscita nel menu
laterale continua a funzionare.

I sei dati mostrati sono nome, cognome, email, telefono, azienda e cantiere.
Non ci sono modifiche a nome, email, azienda o cantiere in questo rilascio.
Il cambio numero richiede una sessione Cognito: non è disponibile per preview
admin o `fincantieri_users` con codice personale.

## API e identità

Tutti gli endpoint richiedono un ID token Cognito verificato e restituiscono
`Cache-Control: no-store`.

| Endpoint | Scopo |
| --- | --- |
| `GET /api/users/me/profile` | Restituisce soltanto i sei campi; il telefono per la ricerca viene dal JWT, non da query o body. |
| `POST /api/users/me/phone-change-context` | Prima di chiedere l'SMS prepara un riferimento firmato con chiave CRM, soggetto Cognito e numeri attuale/nuovo. Non scrive nel CRM. |
| `POST /api/users/me/phone-sync` | Dopo la verifica legge `sub`, `phone_number` e `phone_number_verified` dal token rinnovato e aggiorna soltanto il telefono. |

`/api/users/me`, la sincronizzazione di registrazione e il login ordinario non
cambiano. Non sono necessarie nuove variabili d'ambiente: il riferimento usa
una chiave derivata da `SESSION_SECRET`, separata dai token preview.

Se `userId` coincide con il `sub`, `phone-sync` legge il record per quella
chiave. Altrimenti verifica il riferimento firmato, vincolato al medesimo `sub`
e al nuovo telefono verificato, e legge la chiave CRM stabile contenuta nel
riferimento. Non ricerca mai il proprietario del record tramite il nuovo
telefono e non accetta un identificativo arbitrario dal browser.

Il riferimento scade dopo 24 ore. Il contesto temporaneo è in `sessionStorage`,
isolato per soggetto Cognito; non è un token di accesso e da solo non autorizza
nessuna operazione. L'uscita lo cancella.

Prima della scrittura viene controllata la disponibilità del nuovo numero con
lettura consistente. L'aggiornamento è condizionato all'esistenza del record,
al telefono atteso e al tipo compatibile, tramite `UpdateCommand`, mai
`PutCommand`. La ripetizione dopo un errore di risposta è idempotente.

## Sequenza

1. Formato valido per entrambi i numeri (+39 o +880), normalizzati come nel login.
2. Numero attuale uguale a quello del profilo.
3. Numero nuovo diverso e non presente nel controllo account.
4. Preparazione del riferimento e `updateUserAttributes`.
5. `confirmUserAttribute` con il codice ricevuto.
6. `fetchAuthSession({ forceRefresh: true })`.
7. `phone-sync` con il token nuovo e il riferimento, senza telefono nel body.
8. Aggiornamento dello stato AuthContext e pagina di conferma.

Se il punto 7 fallisce, il contesto rimane nella fase di sincronizzazione:
il pulsante riprova solo il salvataggio, anche dopo un refresh nella stessa
sessione browser, senza chiedere un secondo codice. La pagina di conferma non
viene mostrata prima del salvataggio.

Se l'utente interrompe **prima della verifica**, Cognito conserva il vecchio
numero verificato e il CRM non viene modificato. La configurazione del pool
è già stata eseguita dall'operatore. Nel repository non è presente una
definizione CDK dello UserPool: non è stato quindi aggiunto `keepOriginal`.

## Permessi e dati

Il template `infra/step2connect-users-iam.yaml` include `GetItem`, `Query`,
`Scan` e `UpdateItem`, ma una verifica su una chiave casuale non utente ha
rilevato che **GetItem non è concesso al runtime attuale**. Le nuove letture
usano quindi `Scan` consistente e paginato, già autorizzato, filtrando per
telefono JWT prima del cambio e per chiave CRM stabile dopo la verifica.
Non richiedono un aggiornamento IAM. Il permesso effettivo `UpdateItem` del backend è
stato verificato inviando un aggiornamento con condizione logicamente
impossibile: DynamoDB lo ha autorizzato e rifiutato con
`ConditionalCheckFailedException`. Nessun elemento è stato modificato.

Non sono state modificate configurazioni AWS. Nuovi log di errore generici:
nessun numero, nome, email, codice SMS, token o errore AWS grezzo.

## Test automatici

```sh
npm test
npm run build
node --experimental-websocket scripts/check-profile-browser.cjs
```

`test/profile.test.cjs` verifica campi pubblici, origine JWT dell'identità,
token verificato strettamente booleano, numero occupato, body non attendibile,
riferimento firmato per chiavi CRM diverse dal sub, protezione da manomissione,
ripetizione sicura, fallimento condizionale, ordine della validazione e testi.

Il test browser usa API e Amplify Auth interamente simulati. Verifica le pagine
in IT/EN/BN a 320, 390 e 768 px, menu e badge, matita e controlli per sessione,
errori OTP, attesa reinvio, rinnovo token, errore CRM e ripresa dopo refresh,
cambio interrotto, uscita dalla pagina Profilo e dal menu. Non invia SMS reali
né scrive su AWS.

## Prove SMS reali a cura di Simona, dopo il rilascio

Usare un account Cognito di test, non un accesso con codice personale, e due
numeri propri; il nuovo numero non deve essere già registrato.

### A. Cambio completo e nuovo accesso

1. Accedere con il numero attuale; aprire Profilo → I miei dati → matita.
2. Digitare numero attuale e nuovo numero con prefisso, quindi confermare.
3. Ricevere e inserire il codice arrivato **sul nuovo numero**.
4. Verificare la conferma e che I miei dati mostri il numero nuovo.
5. Uscire; accedere con il nuovo numero e completare il normale login SMS.
6. Verificare che nome, dati, badge e consenso del profilo siano conservati.

### B. Interruzione prima della verifica

1. Iniziare un nuovo cambio verso un altro numero libero.
2. Non inserire il codice ricevuto; uscire o chiudere l'app.
3. Riaprire l'app ed effettuare il login con il numero **precedentemente attivo**.
4. Verificare che I miei dati e CRM conservino quel numero: il cambio non
   confermato non deve averlo sostituito.

## File modificati e creati

Modificati:

- `src/App.jsx`
- `src/components/BottomBar.jsx`
- `src/context/AuthContext.jsx`
- `src/lib/userApi.js`
- `src/i18n/it.js`
- `src/i18n/en.js`
- `src/i18n/bn.js`
- `server/routes/users.js`
- `server/lib/userProfiles.js`
- `README.md`
- `.agents/memory/authenticated-profile-lookup.md`
- `.agents/memory/dynamodb-profile-iam.md`

Creati:

- `src/pages/profile/index.jsx`
- `src/pages/profile/profile.css`
- `src/lib/profilePhoneChange.js`
- `server/lib/profilePhoneReference.js`
- `test/profile.test.cjs`
- `scripts/check-profile-browser.cjs`
- `docs/profile-phone-change.md`
