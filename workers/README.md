# Workers Module

This module owns asynchronous job execution and queue-driven processing.

## Current runtime source

- Active implementation: `../server/workers`
- Queue definitions and Redis adapters remain in `../server/queues`

## Responsibilities

- queue consumers
- retry and dead-letter policy
- workload isolation
- autoscaling signals

## Dependency rule

- Workers consume application services and infrastructure adapters.
- Workers must not be imported by frontend or shared modules.
