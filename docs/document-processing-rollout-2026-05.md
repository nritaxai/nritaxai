# Scalable Document Processing Rollout

## Goals

- Keep existing `/api/pdf` workflows running while moving heavy work off the request path.
- Stage uploads on disk first so API memory use stays bounded under concurrent large uploads.
- Let workers validate, index, and finalize files with retries and dead-letter recovery.
- Expose durable job status and Prometheus metrics for operational visibility.

## Architecture

```mermaid
flowchart LR
    Client[Authenticated Upload] --> API[/api/pdf/upload-pdfs]
    API --> Temp[Disk-backed temp upload]
    Temp --> Stage[Per-upload staging workspace]
    Stage --> Queue[pdf-jobs queue]
    Queue --> Worker[PDF worker processor]
    Worker --> Parse[pdf-parse text extraction]
    Parse --> Index[pdf_index.json locked write]
    Worker --> Final[storage/pdfs final store]
    Worker --> Failed[failed staging archive]
    Queue --> Status[AsyncJob audit status]
    Worker --> Metrics[Prometheus metrics]
```

## Incremental Rollout

1. Deploy code with `BACKGROUND_JOBS_ENABLED=false` and `PDF_QUEUE_ENABLED=false`.
2. Confirm uploads still succeed inline, now using disk-backed staging instead of in-memory buffering.
3. Enable `BACKGROUND_JOBS_ENABLED=true`.
4. Enable `PDF_QUEUE_ENABLED=true` for a low-traffic environment first.
5. Watch:
   - `nritax_document_processing_duration_ms`
   - `nritax_document_processing_runs_total`
   - `nritax_queue_depth{queue="pdf-jobs"}`
   - `nritax_worker_utilization_ratio{queue="pdf-jobs"}`
   - `process_resident_memory_bytes`
6. Scale isolated batch workers with `WORKER_QUEUES=pdf-jobs,report-jobs`.

## Reliability Changes

- Upload validation now checks extension, MIME, size, and PDF header bytes.
- Each upload gets a unique staging workspace under `storage/pdf-processing/staging/<uploadId>`.
- Worker retries still use BullMQ backoff and attempts.
- Failed staged uploads are preserved under `storage/pdf-processing/failed/<uploadId>` for recovery.
- Job state is queryable at `GET /api/pdf/jobs/:jobId`.
- PDF index writes use a filesystem lock to reduce concurrent writer corruption.

## Benchmarking

Run:

```bash
npm --prefix server run benchmark:pdf
```

Optional:

```bash
PDF_BENCHMARK_CONCURRENCY=4 npm --prefix server run benchmark:pdf
```

The script emits JSON with:

- per-file parse duration
- chunk count
- page count
- extraction mode (`native_text` or `ocr_candidate`)
- memory snapshots
- overall throughput

## Monitoring Setup

- API metrics: `GET /metrics`
- Worker metrics: worker standalone metrics server on `WORKER_METRICS_PORT`
- Queue monitoring: existing Redis/BullMQ polling stays enabled
- Recommended alerts:
  - PDF queue wait growing for 10+ minutes
  - Worker utilization above `0.85`
  - Document processing failures above baseline
  - Resident memory sustained above worker request limit

## Current OCR Posture

- Native text PDFs are processed immediately.
- Low-text or scanned PDFs are tagged as `ocr_candidate`.
- No new OCR runtime dependency was introduced in this rollout, so scanned PDFs are now observable and isolatable without breaking the current pipeline.
- A future OCR worker lane can consume the same staged upload manifests without changing the upload API.
