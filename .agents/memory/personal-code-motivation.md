---
name: Personal-code login motivation
description: Perché il prodotto evita SMS nel login del gruppo Fincantieri/ELIS
---

Per il gruppo Fincantieri ed Elis, l'utente vuole evitare il costo degli SMS di
login: “voglio che solo a loro non venga azionato il servizio di cognito che
invia il codice per accedere, per non generare i costi sul servizio inutilmente”.

**Why:** è una richiesta esplicita di contenimento dei costi, non una preview
temporanea né un modo per attribuire privilegi amministrativi.

**How to apply:** quando si modificano recovery o fallback di questo accesso,
non reintrodurre automaticamente un invio SMS senza discutere l'impatto sui
costi. L'utente ha precisato “senza poter entrare nell'area admin”.
