---
name: Segnaposto LivePerson
description: Copia trilingue invariata e confini dei test con il servizio esterno LivePerson.
---

Il segnaposto di Ask Me riproduce il testo trilingue dell'engagement LivePerson,
indipendentemente dalla lingua selezionata nell'app. Non trasferire questa copia
nei dizionari i18n e non renderla un pulsante.

**Why:** l'utente richiede che il passaggio visivo all'engagement esterno sia
indistinguibile; localizzare solo il segnaposto cambierebbe testo e ingombro.

**How to apply:** misurare il vero engagement quando si aggiornano gli stili;
non inserire il segnaposto nel div controllato da LivePerson e non modificarne
il contenuto applicativo.

Nei test browser, limitare le intercettazioni delle API all'origin dell'app,
non a tutte le URL contenenti `/api/`.

**Why:** LivePerson usa percorsi `/api/` propri su domini esterni. I mock generici
li intercettano e possono produrre falsi errori di caricamento del widget.

**How to apply:** distinguere i test con LivePerson deliberatamente bloccato
dalle misurazioni reali, nelle quali le richieste esterne devono passare.
