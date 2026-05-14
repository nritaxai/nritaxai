# nritax.ai Payment Reliability Rollout

## Reliable Payment Architecture

```mermaid
flowchart TD
    Client[Checkout Client] --> API[/api/subscription/create-subscription]
    API --> Attempt[(PaymentAttempt)]
    API --> Audit[(PaymentAuditLog)]
    API --> RP[Razorpay Orders API]
    Client --> Verify[/api/subscription/verify-subscription]
    Verify --> State[Payment State Machine]
    State --> User[(User Subscription)]
    RazorWebhook[Razorpay Webhook] --> Webhook[/api/subscription/razorpay-webhook]
    Webhook --> Event[(PaymentEvent)]
    Webhook --> Audit
    API --> Reconcile[/api/subscription/reconcile]
    Reconcile --> Queue[Payment Reconcile Job]
    Queue --> Worker[Worker Runtime]
    Worker --> RP
    Worker --> Attempt
    Worker --> Audit
    Worker --> User
```

## Checkout Sequence

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant API
    participant Attempt as PaymentAttempt
    participant Audit as PaymentAuditLog
    participant RP as Razorpay

    User->>Client: Start checkout
    Client->>API: POST /create-subscription
    API->>Attempt: find recent unverified matching order
    alt reusable order exists
      API->>RP: fetch existing order
      API->>Audit: log order_reused
      API-->>Client: existing order payload
    else no reusable order
      API->>RP: create order
      RP-->>API: order id
      API->>Attempt: upsert created attempt
      API->>Audit: log order_created
      API-->>Client: new order payload
    end
```

## Verification Sequence

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Attempt as PaymentAttempt
    participant Audit as PaymentAuditLog
    participant User as User Subscription

    Client->>API: POST /verify-subscription
    API->>API: verify signature
    API->>Attempt: load order attempt
    alt already verified same payment
      API-->>Client: already verified success
    else duplicate successful charge
      API->>Audit: log duplicate_charge_blocked
      API-->>Client: 409 conflict
    else valid new verification
      API->>User: apply paid subscription state
      API->>Attempt: mark verified
      API->>Audit: log payment_verified
      API-->>Client: success
    end
```

## Webhook + Recovery Sequence

```mermaid
sequenceDiagram
    participant RP as Razorpay
    participant API
    participant Event as PaymentEvent
    participant Audit as PaymentAuditLog
    participant Queue as Payment Queue
    participant Worker

    RP->>API: webhook delivery
    API->>API: verify webhook signature
    API->>Event: record delivery + dedupe
    alt duplicate processed delivery
      API->>Audit: log duplicate webhook
      API-->>RP: 200 duplicate
    else new delivery
      API->>Audit: log webhook outcome
      API-->>RP: 200 ok
    end

    API->>Queue: enqueue reconcile or retry recovery
    Queue->>Worker: payment.reconcile
    Worker->>RP: fetch order state
    Worker->>API: update attempt + user state + audit log
```

## What This Adds

- Idempotent order reuse for recent unverified checkouts
- Duplicate successful charge blocking at verification time
- Transaction audit logs via `PaymentAuditLog`
- Recovery metadata and retry scheduling fields on `PaymentAttempt`
- Payment reconciliation endpoint and queued recovery workflow
- Reliability summary endpoint for failures, delayed webhooks, and mismatches

## Backward Compatibility

- Existing checkout, verify, and webhook endpoints remain functional
- New endpoints are additive:
  - `GET /api/subscription/reliability-status`
  - `POST /api/subscription/reconcile`
  - `POST /api/subscription/retry-recoveries`
- All changes remain guarded by feature flags where operationally significant

## Rollout Plan

1. Deploy with `PAYMENT_RELIABILITY_ENABLED=true`, `PAYMENT_RECONCILIATION_ENABLED=true`, `PAYMENT_QUEUE_ENABLED=false`
2. Observe `reliability-status` and audit log volume
3. Turn on `BACKGROUND_JOBS_ENABLED=true` and `PAYMENT_QUEUE_ENABLED=true` in staging
4. Enable scheduled `/retry-recoveries` invocation after worker health is stable
5. Add alerting on delayed webhooks and duplicate-charge blocks

## Rollback Plan

1. Turn off `PAYMENT_QUEUE_ENABLED`
2. If necessary, turn off `PAYMENT_RECONCILIATION_ENABLED`
3. Leave `PAYMENT_RELIABILITY_ENABLED` on if audit-only mode is still desired
4. Existing checkout and verify routes keep functioning without the queue path
