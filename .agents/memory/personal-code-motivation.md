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

## Stabilità del CSV admin

L'utente ha corretto la proposta di distinguere entrambi i CSV: “admin lo
lasciamo così, almeno non modifichiamo nulla”. La distinzione del nome riguarda
solo la nuova whitelist Fincantieri.

**Why:** evitare cambiamenti non necessari al percorso già usato
dall'autenticazione amministrativa.

**How to apply:** non rinominare il CSV admin né introdurre percorsi alternativi
come parte di modifiche alla whitelist. I percorsi effettivi sono documentati
in replit.md.
