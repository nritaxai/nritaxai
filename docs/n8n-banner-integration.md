# n8n Banner Integration

## Push To Website Node

Only the `Push To Website` node needs to change.

- Method: `POST`
- URL: `https://nritax.ai/api/banner-updates`
- Send Body: `true`
- Content Type: `JSON`
- JSON Body:

```json
{{ $json }}
```

- Headers:
  - `Content-Type: application/json`
  - `x-api-key: {{ $env.BANNER_API_KEY }}`

## Payload Format

The payload structure remains unchanged:

```json
{
  "updates": [
    {
      "label": "IMPORTANT",
      "title": "Clarification on tax residency certificate requirements for FY 2024-25",
      "country": "India-UAE",
      "date": "2025-01-04",
      "url": "https://nritax.ai/tax-updates/india-uae-trc",
      "active": true,
      "priority": 1
    }
  ]
}
```

## Workflow Compatibility

- Keep the existing workflow shape:
  1. Manual Trigger
  2. Set Banner Data
  3. Format Banner
  4. Push To Website
- Do not change the `Format Banner` output.
- Do not change any node except `Push To Website`.
