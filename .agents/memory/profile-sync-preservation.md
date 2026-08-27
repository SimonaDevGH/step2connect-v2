---
name: Profile sync preservation
description: Regola per impedire che un login normale cancelli dati profilo già salvati
---

La sincronizzazione del profilo deve inviare soltanto valori non vuoti. Se dopo il filtro rimane solo il telefono, la chiamata di sincronizzazione non deve partire.

**Why:** il login normale non raccoglie nuovamente nome, cognome, email, azienda e cantiere; inviare stringhe vuote a un backend upsert cancella valori già presenti o impostati manualmente.

**How to apply:** filtrare centralmente il payload prima di `/users/sync`; stringhe vuote, spazi, `null` e `undefined` significano “non modificare”, mentre la successiva lettura autenticata del profilo deve comunque essere eseguita.