# Banner Service Setup

## Files

- `server/banner-service/server.js`
- `server/banner-service/package.json`
- `docs/banner-frontend-snippet.js`

## Run Locally

From the repo root:

```bash
cd server/banner-service
npm install
npm start
```

The banner backend will listen on:

```text
http://localhost:3000
```

## API Endpoints

- `POST /api/banner-updates`
- `GET /api/banner-updates`

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

1. Start the banner service with `npm start`.
2. Run the n8n workflow that POSTs to `http://localhost:3000/api/banner-updates`.
3. Confirm the server logs `Banner updated:` with the stored items.
4. Open the website and confirm the frontend fetches `http://localhost:3000/api/banner-updates`.
5. The scrolling ticker should refresh automatically every 5 minutes.

## Notes

- The service stores data in memory only, so restarting the process clears the banner.
- The existing NRITAX frontend now reads banner data from `VITE_BANNER_API_URL` when provided.
- In local development, the frontend defaults to `http://localhost:3000`.
