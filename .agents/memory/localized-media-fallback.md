---
name: Localized media fallback
description: Compatibilità sicura tra valori CMS legacy globali e media localizzati
---

# Fallback per media localizzati

Quando un contenuto multilingua viene letto o risalvato, il fallback dal formato legacy globale va applicato soltanto se il campo della lingua è assente. Una stringa vuota è un valore esplicito e non deve essere sostituita.

**Why:** un fallback basato sulla verità del valore ripopolerebbe involontariamente video, immagini o icone italiani nelle altre lingue dopo un salvataggio, impedendo anche di rimuovere un media in una sola lingua.

**How to apply:** distinguere sempre la presenza della proprietà dal suo contenuto durante lettura, validazione e salvataggio; conservare `''` quando è stato inviato intenzionalmente.