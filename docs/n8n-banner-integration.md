# n8n Banner Integration

## HTTP Request Node

Use an `HTTP Request` node after your scheduler/data-formatting nodes.

- Method: `POST`
- URL: `http://localhost:5000/api/banner-updates`
  Replace with your production API base URL when deploying.
- Headers:
  - `Content-Type: application/json`
  - `x-api-key: YOUR_SECRET_KEY`
- Send Body: `true`
- Content Type: `JSON`
- JSON Body:

```json
{{ $json }}
```

## Supported Payload Shapes

The NRITAX backend accepts either of these payload shapes from n8n:

```json
[
  {
    "label": "IMPORTANT",
    "date": "2025-01-04",
    "country": "India-UAE",
    "title": "Clarification on tax residency certificate requirements for FY 2024-25",
    "url": "/tax-updates/india-uae-trc",
    "active": true,
    "priority": 1
  }
]
```

```json
{
  "updates": [
    {
      "label": "IMPORTANT",
      "date": "2025-01-04",
      "country": "India-UAE",
      "title": "Clarification on tax residency certificate requirements for FY 2024-25",
      "url": "/tax-updates/india-uae-trc",
      "active": true,
      "priority": 1
    }
  ]
}
```

## Backend Endpoints

- `POST /api/banner-updates`
  Replaces the in-memory banner data with the incoming n8n payload.
- `GET /api/banner-updates`
  Returns active items sorted by `priority` ascending and `date` descending.

## Security

Set `BANNER_API_KEY` in the server environment to require the `x-api-key` header.
If `BANNER_API_KEY` is empty, the POST endpoint stays open for local development.

## End-to-End Flow

1. n8n schedules and formats update data.
2. n8n posts the payload to `POST /api/banner-updates`.
3. The NRITAX backend stores the data in memory.
4. The website header fetches `GET /api/banner-updates` every 5 minutes.
5. The frontend ticker renders the updates as a continuous scrolling banner.
