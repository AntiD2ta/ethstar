# Vercel KV (REST API)

No Redis client library. All access via HTTP REST.

## Command mapping

- Single-key reads: `GET /get/{key}`, `GET /exists/{key}`, `GET /incrby/{key}/{amount}`.
- Single generic command: `POST /` with body `["SET", key, value, "EX", ttl]`.
- Response: JSON with a `result` field (string, int, or null).

## Always escape keys

Wrap keys with `url.PathEscape` when interpolating into URL paths. Current keys (`tok:hash`) use colons (safe), but future keys could contain `/`, `?`, or `#` that silently corrupt the URL. Defense-in-depth for the generic helpers.

## Multi-key writes

Prefer `/pipeline` for atomic multi-key writes (one round-trip):

```go
// POST /pipeline with body: [["INCRBY","key1",5],["INCRBY","key2",1]]
```

Response is a JSON array of per-command results.

## Parallel reads

For independent reads in a serverless function, use `sync.WaitGroup` to halve latency. Each goroutine writes to its own variable pair — no shared mutable state, no mutex needed.

```go
var wg sync.WaitGroup
var a, b int
wg.Add(2)
go func() { defer wg.Done(); a = fetchA() }()
go func() { defer wg.Done(); b = fetchB() }()
wg.Wait()
```

Use the pipeline endpoint for writes, parallel goroutines for reads.
