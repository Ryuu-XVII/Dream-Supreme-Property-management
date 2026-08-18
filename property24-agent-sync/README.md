# Property24 Agent Sync

Small Node.js service that accepts a public Property24 estate-agent profile URL and returns that agent's current sale/rental listings as JSON.

It does **not** log in, solve CAPTCHAs, use stealth plugins, or attempt to bypass Property24 access controls. It fetches public pages at a conservative rate and stops with an error if access is refused.

## Requirements

- Node.js 20+

## Install and run

```bash
npm install
npm start
```

The API starts on `http://localhost:3000` by default.

## API

### `POST /scrape`

```json
{
  "agentUrl": "https://www.property24.com/estate-agents/real-estate-services/aaron-fanie-sithabela/448298",
  "include": ["sale", "rent"],
  "maxPages": 10,
  "delayMs": 750
}
```

Example:

```bash
curl -X POST http://localhost:3000/scrape \
  -H 'content-type: application/json' \
  -d '{
    "agentUrl":"https://www.property24.com/estate-agents/real-estate-services/aaron-fanie-sithabela/448298"
  }'
```

Typical response shape:

```json
{
  "source": "Property24",
  "scrapedAt": "2026-08-14T12:00:00.000Z",
  "agent": {
    "id": "448298",
    "slug": "aaron-fanie-sithabela",
    "agencySlug": "real-estate-services",
    "profileUrl": "https://www.property24.com/estate-agents/real-estate-services/aaron-fanie-sithabela/448298"
  },
  "counts": {
    "total": 3,
    "sale": 3,
    "rent": 0
  },
  "listings": [
    {
      "id": "117430041",
      "purpose": "sale",
      "url": "https://www.property24.com/for-sale/.../117430041",
      "price": "R 620 000",
      "title": "1 Bedroom Apartment ...",
      "imageUrl": "https://images.prop24.com/...",
      "bedrooms": 1,
      "bathrooms": 1,
      "garages": null,
      "parking": 1,
      "floorSize": "57 m²",
      "summary": "..."
    }
  ]
}
```

## CLI

```bash
npm run scrape -- "https://www.property24.com/estate-agents/real-estate-services/aaron-fanie-sithabela/448298"
```

## How it works

Given:

`/estate-agents/{agency}/{agent}/{agentId}`

it derives the two public agent listing feeds:

- `/for-sale/agency/{agency}/{agent}/{agentId}`
- `/to-rent/agency/{agency}/{agent}/{agentId}`

It then extracts Property24 property-detail links, normalizes listing IDs/URLs, pulls card-level metadata, follows the page's own `Next` link, and deduplicates results.

## Production notes

- Run this server-side, not in the browser, to avoid CORS issues and exposing scraping logic.
- Cache each agent result for a sensible interval (for example 15–60 minutes) instead of scraping on every profile view.
- Keep the request rate conservative. The default is 750 ms between Property24 pages and the service enforces a 250 ms minimum.
- Check Property24's current Terms & Conditions/robots policy and obtain permission if your intended use requires it.
- If Property24 changes its HTML, update the DOM extraction in `src/property24.js`.
