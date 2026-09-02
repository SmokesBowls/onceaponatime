# Hermes Raw Inference Boundary Contract

Status: Normative v1

Repositories:

- Narrative governor: `/mnt/data-drive/onceaponatime`
- Inference broker: Hermes Agent

## 1. Final authority split

```text
Onceaponatime -> HermesProvider -> Hermes raw inference broker -> selected model
```

Onceaponatime owns:

- Codex and narrative state;
- epistemic and temporal authorization;
- context compilation;
- narrative-distance constraints;
- domain validation;
- candidate acceptance and canon promotion;
- durable inference receipts associated with narrative candidates.

Hermes owns:

- inference-provider and model selection;
- credential resolution and authentication;
- bounded same-route retries;
- the configured fallback chain;
- model availability;
- transport normalization;
- truthful execution metadata.

The underlying model may propose output. It owns no narrative truth, validation result, state mutation, or canon decision.

## 2. Non-goals

This boundary is not:

- the Hermes subscription proxy, which requires the caller to select a model;
- the Hermes agent API, which adds tools, skills, memory, and an agent loop;
- a model picker exposed to Onceaponatime;
- a canon-promotion endpoint;
- permission for Hermes to retain or independently retrieve story state.

The raw inference broker must not run tools, load agent memory, load skills, create an agent session, or mutate project files/state.

## 3. HTTP boundary

Hermes exposes an authenticated endpoint on its API-server listener:

```text
POST /v1/inference
```

Authentication uses the API server's existing bearer policy. The request and response media type is `application/json`.

### 3.1 Request

```json
{
  "schema": "hermes.inference.request.v1",
  "request_id": "caller-generated correlation id",
  "operation": "onceaponatime.stage1.plan",
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "options": {
    "temperature": 0.3,
    "max_output_tokens": 4096,
    "response_format": "json"
  }
}
```

Required fields:

- `schema` must equal `hermes.inference.request.v1`;
- `request_id` must be a non-empty, bounded string without control characters;
- `operation` must be a non-empty audit label;
- `messages` must be a non-empty array of closed objects containing only `role` and `content`;
- message roles are limited to `system`, `user`, and `assistant`;
- message content must be a string;
- at least one `user` message must contain non-whitespace text.

`options` is optional and closed. Supported keys are:

- `temperature`: finite number from 0 through 2;
- `max_output_tokens`: positive integer within Hermes's configured cap;
- `response_format`: `text` or `json`.

The request must not contain provider, model, base URL, API key, fallback route, tool, skill, memory, session, filesystem, or canon-promotion fields. Unknown fields fail validation.

### 3.2 Successful response

```json
{
  "schema": "hermes.inference.response.v1",
  "request_id": "exact request correlation id",
  "status": "completed",
  "output": {
    "text": "model output"
  },
  "execution": {
    "provider": "actual provider identifier",
    "model": "actual model identifier",
    "fallback_used": false,
    "fallback_index": 0,
    "attempt_count": 1
  }
}
```

Success requires:

- exact request-ID echo;
- non-empty output text;
- non-empty actual provider and model identifiers;
- boolean `fallback_used`;
- integer `fallback_index`, where primary is `0`;
- `fallback_used` equals `fallback_index > 0`;
- positive integer `attempt_count` covering configured provider/model routes attempted. Same-route transport retries and credential-pool rotations remain internal to that route and do not increment this field.

The model identifier must describe the route that actually executed the successful request. When an upstream reports a more specific model identifier, Hermes records that value. Hermes may use its resolved target identifier only when the route deterministically binds that target. A router that can conceal the executing model cannot satisfy this contract without upstream attestation.

### 3.3 Failed response

```json
{
  "schema": "hermes.inference.response.v1",
  "request_id": "exact request correlation id or null when request identity is invalid",
  "status": "failed",
  "error": {
    "code": "no_usable_model",
    "message": "redacted operator-safe description",
    "retryable": false
  }
}
```

Failed responses contain no plausible narrative output. Errors must not expose credentials, authorization headers, raw tokens, or unredacted provider payloads.

Expected classes include:

- `invalid_request` (HTTP 400);
- `no_usable_model` (HTTP 503);
- `inference_failed` (HTTP 502);
- `malformed_model_output` (HTTP 502);
- `internal_error` (HTTP 500).

## 4. Selection and fallback

Onceaponatime sends no model or provider choice.

Hermes resolves:

1. the configured primary provider/model;
2. bounded retries for that exact route;
3. configured `fallback_providers` in order.

A fallback is any successful route with `fallback_index > 0`. Credential-pool rotation or a transport retry that preserves the same provider/model route is internal to one route attempt, not a model fallback.

Hermes must never silently claim the primary executed when a fallback did. If no route succeeds, it returns `status: failed`.

## 5. Output validation

Hermes validates transport-level output:

- output exists and is non-empty;
- `response_format: json` parses as strict JSON;
- response and execution receipt satisfy this closed contract.

Onceaponatime independently validates operation-specific structure and narrative constraints. A syntactically valid model response is still only a candidate.

## 6. Onceaponatime admission rules

`HermesProvider` must reject:

- non-2xx responses;
- invalid JSON envelopes;
- schema-version mismatch;
- request-ID mismatch;
- missing/empty output;
- missing or empty provider/model identifiers;
- missing or inconsistent fallback metadata;
- failed, partial, or unknown status;
- malformed operation-specific output.

Rejected inference must not produce fallback prose, pass validation, mutate Codex, or enter canon.

Every admitted candidate carries the immutable execution receipt through planning, rendering, validation, review, and canon-promotion decisions.

## 7. Promotion law

```text
inference completion != valid candidate
valid candidate != verified candidate
verified candidate != accepted candidate
accepted candidate != canon until Onceaponatime performs promotion
```

Hermes cannot approve any of these transitions.

## 8. Red lines

- Onceaponatime must not directly instantiate Gemini, Claude, GPT, Ollama, or other model SDKs on the normal execution path.
- Hermes must not fabricate output when inference is unavailable.
- Onceaponatime must not fabricate output when Hermes is unavailable or rejects a request.
- A failed or unverified candidate must not enter canon.
- Receipts must never contain credentials.
- Provider fallback must be visible in the receipt.
- No component may infer success from HTTP 200 alone.

## 9. Versioning

Changes that add optional metadata may retain v1. Changes to required fields, authority, selection semantics, or admission rules require a new schema version and explicit dual-version migration.

## 10. Final invariant

Onceaponatime governs narrative truth. Hermes supplies interchangeable inference and a truthful execution receipt. The model supplies a proposal only.
