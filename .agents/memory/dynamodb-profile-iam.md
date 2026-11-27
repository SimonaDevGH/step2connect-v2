---
name: DynamoDB profile IAM
description: Permessi AWS mancanti per leggere e aggiornare i ruoli in Step2Connect_Users
---

L’identità AWS del backend deve poter leggere `Step2Connect_Users` con il percorso scelto per telefono (`Scan` senza indice configurato, oppure `Query` su un indice). Il comando operatore di provisioning dei ruoli richiede anche `UpdateItem`.

**Why:** il controllo del ruolo runtime fallisce in modo conservativo quando la lettura non è disponibile, mentre senza `UpdateItem` il comando operatore non può marcare i profili amministratori. `DescribeTable` non è necessario né al runtime né al comando attuale.

**How to apply:** concedere all’identità backend i permessi minimi sulla sola tabella e sull’eventuale indice telefonico; usare il comando operatore, non una route HTTP, e verificare sia un admin reale sia che gli utenti non marcati restino standard.

Non assumere che le operazioni nel template IAM siano già tutte autorizzate:
la verifica dell'ambiente ha confermato UpdateItem ma negato GetItem.
Le letture del profilo devono poter funzionare con Scan, anche quando cercano
un identificativo stabile invece del telefono.

**Why:** è richiesto che le pagine Profilo funzionino senza modificare le
configurazioni AWS esistenti; il template non prova i permessi del runtime.

**How to apply:** non introdurre una dipendenza obbligatoria da GetItem senza
verificare prima l'autorizzazione effettiva o concordare l'aggiornamento IAM.