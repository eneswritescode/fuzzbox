# API Reference

Complete API documentation for Fuzzbox configuration and types.

## Table of Contents

- [Express Middleware](#express-middleware)
- [Next.js Middleware](#nextjs-middleware)
- [Next.js API Route Wrapper](#nextjs-api-route-wrapper)
- [Configuration Types](#configuration-types)
- [Behavior Configuration](#behavior-configuration)

---

## Express Middleware

### `fuzzboxExpress(config?: FuzzboxConfig)`

Creates Express middleware that injects chaos into HTTP responses.

**Parameters:**
- `config` (optional): Configuration object. See [FuzzboxConfig](#fuzzboxconfig).

**Returns:** Express middleware function `(req, res, next) => void`

**Example:**
```typescript
import express from 'express';
import { fuzzboxExpress } from 'fuzzbox';

const app = express();

app.use(fuzzboxExpress({
  probability: 0.2,
  includeRoutes: ['/api/*'],
}));

app.listen(3000);
```

---

## Next.js Middleware

### `fuzzboxNext(config?: FuzzboxConfig)`

Creates Next.js middleware for App Router (Edge Runtime).

**Parameters:**
- `config` (optional): Configuration object. See [FuzzboxConfig](#fuzzboxconfig).

**Returns:** Async middleware function `(req: NextRequest) => Promise<Response | void>`

**Example:**
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { fuzzboxNext } from 'fuzzbox';

const fuzzbox = fuzzboxNext({
  probability: 0.15,
  includeRoutes: ['/api/*'],
});

export async function middleware(req: NextRequest) {
  const chaosResponse = await fuzzbox(req);
  if (chaosResponse) return chaosResponse;
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

**Note:** Some behaviors (zombie mode, header havoc) have limited support in Edge Runtime.

---

## Next.js API Route Wrapper

### `fuzzboxApiRoute(handler, config?: FuzzboxConfig)`

Wraps a Next.js API route handler (Pages Router) with chaos injection.

**Parameters:**
- `handler`: Your API route handler function
- `config` (optional): Configuration object. See [FuzzboxConfig](#fuzzboxconfig).

**Returns:** Wrapped handler function

**Example:**
```typescript
// pages/api/users.ts
import { fuzzboxApiRoute } from 'fuzzbox';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ users: [] });
}

export default fuzzboxApiRoute(handler, {
  probability: 0.2,
  behaviors: {
    bodyMutation: { enabled: true },
    errors: { enabled: true },
  },
});
```

---

## Configuration Types

### `FuzzboxConfig`

Main configuration interface for Fuzzbox.

```typescript
interface FuzzboxConfig {
  // Global probability (0-1) that chaos will be injected
  probability?: number; // Default: 0.1 (10%)

  // Enable/disable Fuzzbox entirely
  enabled?: boolean; // Default: true

  // Only fuzz routes matching these patterns (empty = all routes)
  includeRoutes?: (string | RegExp)[]; // Default: []

  // Never fuzz routes matching these patterns (takes precedence)
  excludeRoutes?: (string | RegExp)[]; // Default: []

  // Path for the live dashboard (null to disable)
  dashboardPath?: string | null; // Default: '/__fuzzbox'

  // Disable all console logging
  silent?: boolean; // Default: false

  // Custom logger function
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;

  // Chaos behavior configuration
  behaviors?: BehaviorsConfig;
}
```

---

## Behavior Configuration

### `BehaviorsConfig`

Configure which chaos behaviors are enabled and their settings.

```typescript
interface BehaviorsConfig {
  latency?: LatencyConfig;
  errors?: ErrorConfig;
  timeout?: TimeoutConfig;
  bodyMutation?: BodyMutationConfig;
  zombieMode?: ZombieModeConfig;
  headerHavoc?: HeaderHavocConfig;
  rateLimit?: RateLimitConfig;
}
```

### `LatencyConfig`

Inject random delays into responses.

```typescript
interface LatencyConfig {
  enabled?: boolean; // Default: true
  minMs?: number;    // Default: 100
  maxMs?: number;    // Default: 3000
}
```

**Example:**
```typescript
behaviors: {
  latency: {
    enabled: true,
    minMs: 500,
    maxMs: 2000,
  }
}
```

### `ErrorConfig`

Randomly throw HTTP error responses.

```typescript
interface ErrorConfig {
  enabled?: boolean;          // Default: true
  statusCodes?: number[];     // Default: [500, 502, 503, 504]
}
```

**Example:**
```typescript
behaviors: {
  errors: {
    enabled: true,
    statusCodes: [500, 503], // Only 500 and 503
  }
}
```

### `TimeoutConfig`

Hold requests indefinitely without responding.

```typescript
interface TimeoutConfig {
  enabled?: boolean;      // Default: true
  probability?: number;   // Default: 0.2 (20% of chaos events)
}
```

**Example:**
```typescript
behaviors: {
  timeout: {
    enabled: true,
    probability: 0.1, // 10% of chaos events will timeout
  }
}
```

### `BodyMutationConfig`

Corrupt JSON response bodies.

```typescript
interface BodyMutationConfig {
  enabled?: boolean;           // Default: true
  statusCodes?: number[];      // Default: [200]
  fieldProbability?: number;   // Default: 0.3 (30% of fields mutated)
}
```

**Mutation Rules:**
- Strings → `undefined`
- Numbers → `-999`
- Booleans → flipped (`true` → `false`)
- Objects/Arrays → recursively mutated

**Example:**
```typescript
behaviors: {
  bodyMutation: {
    enabled: true,
    statusCodes: [200, 201],
    fieldProbability: 0.5, // More aggressive mutation
  }
}
```

### `ZombieModeConfig`

Stream responses extremely slowly (byte by byte).

```typescript
interface ZombieModeConfig {
  enabled?: boolean;          // Default: true
  bytesPerSecond?: number;    // Default: 10
  probability?: number;       // Default: 0.1 (10% of chaos events)
}
```

**Example:**
```typescript
behaviors: {
  zombieMode: {
    enabled: true,
    bytesPerSecond: 5,  // Even slower
    probability: 0.2,
  }
}
```

**Note:** Not supported in Next.js Edge Runtime.

### `HeaderHavocConfig`

Scramble, delete, or alter response headers.

```typescript
interface HeaderHavocConfig {
  enabled?: boolean;              // Default: true
  targetHeaders?: string[];       // Default: [] (random headers)
}
```

**Actions:**
- `delete`: Remove a header
- `scramble`: Reverse the header value
- `alter`: Change Content-Type to text/plain or append chaos flags

**Example:**
```typescript
behaviors: {
  headerHavoc: {
    enabled: true,
    targetHeaders: ['Content-Type', 'Cache-Control'],
  }
}
```

### `RateLimitConfig`

Simulate rate limiting with 429 responses.

```typescript
interface RateLimitConfig {
  enabled?: boolean;           // Default: true
  requestLimit?: number;       // Default: 10
  windowMs?: number;           // Default: 60000 (1 minute)
  retryAfterSeconds?: number;  // Default: 60
}
```

**Example:**
```typescript
behaviors: {
  rateLimit: {
    enabled: true,
    requestLimit: 5,        // 5 requests
    windowMs: 10000,        // per 10 seconds
    retryAfterSeconds: 30,  // Retry-After: 30
  }
}
```

**Note:** This is **fake** rate limiting for testing only. It doesn't actually protect your server.

---

## Route Matching

### Include/Exclude Patterns

Both `includeRoutes` and `excludeRoutes` accept arrays of strings or RegExp patterns.

**String Matching:**
Uses `startsWith()` for prefix matching.

```typescript
includeRoutes: ['/api/users', '/api/orders']
// Matches: /api/users, /api/users/123, /api/orders/456
// Does NOT match: /api/products
```

**RegExp Matching:**
Full regex support for complex patterns.

```typescript
includeRoutes: [/^\/api\/(users|orders)/]
// Matches: /api/users, /api/orders, /api/users/123
// Does NOT match: /api/products

excludeRoutes: [/\/(health|metrics)$/]
// Excludes: /health, /metrics, /api/health
```

**Precedence:**
`excludeRoutes` takes precedence over `includeRoutes`.

```typescript
{
  includeRoutes: ['/api/*'],
  excludeRoutes: ['/api/health']
}
// Fuzzes all /api/* EXCEPT /api/health
```

---

## Dashboard API

When enabled, Fuzzbox exposes a dashboard at the configured path (default: `/__fuzzbox`).

### GET `/__fuzzbox`

Serves the dashboard HTML UI.

### GET `/__fuzzbox/api/state`

Returns current Fuzzbox state.

**Response:**
```json
{
  "enabled": true,
  "probability": 0.1,
  "spikeMode": false,
  "requestCount": 1234,
  "chaosCount": 123
}
```

### POST `/__fuzzbox/api/state`

Updates Fuzzbox state dynamically.

**Request Body:**
```json
{
  "enabled": false,           // Enable/disable
  "probability": 0.5,         // Change probability
  "spikeMode": true,          // Trigger spike mode (80% for 30s)
  "reset": true               // Reset statistics
}
```

**Response:** Same as GET (updated state)

---

## TypeScript Types

All types are exported from the main package:

```typescript
import type {
  FuzzboxConfig,
  FuzzboxState,
  ChaosAction,
  LatencyConfig,
  ErrorConfig,
  TimeoutConfig,
  BodyMutationConfig,
  ZombieModeConfig,
  HeaderHavocConfig,
  RateLimitConfig,
} from 'fuzzbox';
```

### `ChaosAction`

Internal type representing a chaos action. Not typically used directly.

```typescript
type ChaosAction =
  | { type: 'latency'; delayMs: number }
  | { type: 'error'; statusCode: number }
  | { type: 'timeout' }
  | { type: 'bodyMutation' }
  | { type: 'zombieMode' }
  | { type: 'headerHavoc'; action: 'delete' | 'scramble' | 'alter'; header?: string }
  | { type: 'rateLimit' }
  | { type: 'none' };
```

### `FuzzboxState`

Internal mutable state. Exposed for advanced use cases.

```typescript
interface FuzzboxState {
  enabled: boolean;
  probability: number;
  spikeMode: boolean;
  spikeModeExpiry: number | null;
  requestCount: number;
  chaosCount: number;
  rateLimitCounter: Map<string, { count: number; resetAt: number }>;
}
```

---

## Custom Logger

Provide a custom logger to control where chaos events are logged.

**Example:**
```typescript
app.use(fuzzboxExpress({
  logger: (message, level) => {
    if (level === 'error') {
      console.error(`[CHAOS ERROR] ${message}`);
    } else {
      console.log(`[CHAOS ${level.toUpperCase()}] ${message}`);
    }
  },
}));
```

**Log Levels:**
- `info`: General information (middleware started, config changes)
- `warn`: Chaos action taken (latency injected, body mutated)
- `error`: Error response or severe chaos (timeout, 500 errors)

---

## Advanced Examples

### Chaos Testing Payment Endpoints Only

```typescript
app.use(fuzzboxExpress({
  probability: 0.3,
  includeRoutes: [/^\/api\/payments/],
  behaviors: {
    errors: { enabled: true, statusCodes: [500, 503] },
    timeout: { enabled: true, probability: 0.1 },
    latency: { enabled: true, minMs: 1000, maxMs: 5000 },
    // Disable data corruption for payments
    bodyMutation: { enabled: false },
    zombieMode: { enabled: false },
    headerHavoc: { enabled: false },
  },
}));
```

### Frontend Resilience Testing

```typescript
app.use(fuzzboxExpress({
  probability: 0.4,
  behaviors: {
    bodyMutation: {
      enabled: true,
      fieldProbability: 0.5, // Aggressively corrupt data
    },
    errors: { enabled: true },
    latency: { enabled: true, minMs: 100, maxMs: 1000 },
    // Disable connection-level chaos
    timeout: { enabled: false },
    zombieMode: { enabled: false },
  },
}));
```

### Load Testing with Spike Mode

```typescript
// Trigger via dashboard or programmatically
const fuzzboxMiddleware = fuzzboxExpress({ probability: 0.1 });

// Later, via dashboard POST /__fuzzbox/api/state:
// { "spikeMode": true }
// This sets 80% chaos for 30 seconds automatically
```

---

## Performance Impact

| Behavior | Overhead | Notes |
|----------|----------|-------|
| Latency | ~0-3000ms | Async delay, doesn't block other requests |
| Errors | <1ms | Immediate response |
| Timeout | N/A | Connection held forever |
| Body Mutation | 1-10ms | Depends on JSON size |
| Zombie Mode | N/A | Keeps connection open indefinitely |
| Header Havoc | <1ms | String manipulation |
| Rate Limit | <1ms | Map lookup |

**Probability overhead:** Each request evaluates probability (~0.1ms).

When chaos is **not** triggered, overhead is negligible (<1ms).

---

## Compatibility

| Environment | Support | Notes |
|-------------|---------|-------|
| Express 4.x | ✅ Full | All features supported |
| Express 5.x | ✅ Full | All features supported |
| Next.js App Router | ⚠️ Partial | Zombie mode and some header havoc not available in Edge Runtime |
| Next.js Pages Router | ✅ Full | All features supported via `fuzzboxApiRoute` |
| Fastify | ❌ Untested | May work with compat layer |
| Koa | ❌ Untested | May work with compat layer |
| Node.js | >=16.0.0 | Uses modern APIs |

---

## FAQ

**Q: Can I use multiple Fuzzbox instances?**
A: Yes, but each maintains its own state. Stats won't be shared.

**Q: Does Fuzzbox affect static files?**
A: Only if they go through the middleware stack. Serve static files before Fuzzbox.

**Q: Can I disable specific behaviors at runtime?**
A: No, behaviors are configured at startup. Use the dashboard to adjust probability instead.

**Q: What happens if I set probability to 1.0?**
A: Every single request gets chaos. Probably a bad idea.

**Q: Is there a way to trigger specific chaos actions?**
A: No, chaos is random by design. For deterministic testing, write unit tests.

**Q: Can I use this with GraphQL?**
A: Yes, but body mutation will likely generate invalid GraphQL responses.
