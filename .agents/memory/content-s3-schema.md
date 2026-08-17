---
name: Content S3 schema
description: Struttura delle chiavi S3 per i contenuti admin di Step2Connect
---

# Schema S3 contenuti

## Struttura chiavi
```
content/draft/{type}/{lang}/{id}.json        ← bozze (solo admin)
content/published/{type}/{lang}/{id}.json    ← pubblicati (pubblici)
content/archive/{type}/{lang}/{id}_{ts}.json ← archiviati (mai eliminati)
media/{type}/{id}/{timestamp}.{ext}          ← immagini caricate
```

## Tipi
`type` ∈ `guides | news | library`

## Lingua
`lang` ∈ `it | en | bn`

## Struttura JSON singolo item
```json
{
  "id": "permitRequest",
  "type": "guides",
  "lang": "it",
  "category": "documents",
  "emoji": "📄",
  "title": "...",
  "body": "... HTML sanificato ...",
  "imageUrl": "",
  "audioUrl": "",
  "updatedBy": "cognito-sub",
  "updatedAt": "ISO-8601"
}
```

**Why (file per lingua):** ogni lingua è indipendente — un admin può pubblicare IT senza aver completato BN. Semplifica il publish parziale.

**How to apply:** il form admin (ContentEditForm) carica le tre lingue via GET /api/admin/content/:type/:id e salva tutte e tre via PUT.
