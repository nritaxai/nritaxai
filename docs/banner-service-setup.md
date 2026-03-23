# Banner Service Setup

## Files

- `server/banner-service/server.js`
- `server/banner-service/package.json`
- `server/banner-service/.env.example`
- `docs/banner-frontend-example.html`
- `docs/n8n-push-to-website-node.json`

## Deploy

Deploy the backend on the NRITAX domain or an API subdomain that is publicly reachable over HTTPS.

Recommended production endpoint:
`https://nritax.ai/api/banner-updates`

## API Endpoints

- `POST /api/banner-updates`
- `GET /api/banner-updates`
- `GET /health`

## Expected POST Payload

```json
{
  "updates": [
    {
      "label": "IMPORTANT",
      "title": "Clarification on tax residency certificate requirements for FY 2024-25",
      "country": "India-UAE",
      "date": "2025-01-04",
      "url": "/tax-updates/india-uae-trc",
      "active": true,
      "priority": 1
    }
  ]
}
```

## n8n Flow

1. Deploy the backend and expose `https://nritax.ai/api/banner-updates`.
2. Set `BANNER_API_KEY` in the backend environment.
3. Update only the n8n `Push To Website` node to POST to `https://nritax.ai/api/banner-updates`.
4. Send the workflow payload unchanged as `{{ $json }}`.
5. Confirm `GET https://nritax.ai/health` responds with `{ "ok": true }`.
6. Confirm the website banner fetches `https://nritax.ai/api/banner-updates`.
7. The scrolling ticker should refresh automatically every 5 minutes.

## Notes

- The service stores data in memory only, so restarting the process clears the banner.
- Add the `x-api-key` header in n8n if API-key protection is enabled.
- The NRITAX frontend banner now targets `https://nritax.ai/api/banner-updates` by default.
