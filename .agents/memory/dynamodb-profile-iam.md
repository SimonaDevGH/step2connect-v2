---
name: DynamoDB profile IAM
description: Permessi AWS mancanti per leggere e aggiornare i ruoli in Step2Connect_Users
---

L’identità AWS del backend deve poter leggere `Step2Connect_Users` con il percorso scelto per telefono (`Scan` senza indice configurato, oppure `Query` su un indice). Il comando operatore di provisioning dei ruoli richiede anche `UpdateItem`.

**Why:** il controllo del ruolo runtime fallisce in modo conservativo quando la lettura non è disponibile, mentre senza `UpdateItem` il comando operatore non può marcare i profili amministratori. `DescribeTable` non è necessario né al runtime né al comando attuale.

**How to apply:** concedere all’identità backend i permessi minimi sulla sola tabella e sull’eventuale indice telefonico; usare il comando operatore, non una route HTTP, e verificare sia un admin reale sia che gli utenti non marcati restino standard.