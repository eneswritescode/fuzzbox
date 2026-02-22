# Architecture

Internal architecture and design decisions for Fuzzbox.

## Design Principles

1. **Zero runtime dependencies** - Only use Node.js built-ins
2. **Minimal overhead** - When chaos isn't triggered, impact should be <1ms
3. **Framework agnostic core** - Chaos logic separated from adapters
4. **Mutable state** - Dashboard needs to modify config at runtime
5. **Fail-safe** - TypeScript strict mode, comprehensive error handling

---

## Project Structure

```
fuzzbox/
├── src/
│   ├── core.ts              # Central chaos engine
│   ├── types.ts             # TypeScript interfaces
│   ├── adapters/
│   │   ├── express.ts       # Express-specific middleware
│   │   └── next.ts          # Next.js-specific middleware
│   ├── mutators/
│   │   ├── bodyMutator.ts   # JSON corruption logic
│   │   ├── headerMutator.ts # Header manipulation
│   │   └── zombieMode.ts    # Slow stream implementation
│   └── dashboard/
│       └── template.ts      # Self-contained HTML/CSS/JS
└── tests/
    ├── core.test.js         # Core logic unit tests
    ├── mutators.test.js     # Mutator unit tests
    └── integration.test.js  # End-to-end tests
```

---

## Core Components

### 1. Chaos Engine (`core.ts`)

**Responsibilities:**
- Merge user config with defaults
- Probability calculation
- Route matching logic
- Chaos action selection
- ANSI-colored logging
- State management for dashboard

**Key Functions:**

```typescript
// Deep merge user config with sane defaults
mergeConfig(userConfig: FuzzboxConfig)

// Create mutable state object
createState(): FuzzboxState

// Check if route should be fuzzed based on patterns
shouldFuzzRoute(path, includeRoutes, excludeRoutes): boolean

// Decide if chaos should happen (probability + spike mode)
shouldInjectChaos(state: FuzzboxState): boolean

// Select which chaos action to apply
selectChaosAction(config): ChaosAction

// Check rate limiting (fake, for testing only)
checkRateLimit(state, config, clientId): boolean

// Create colorized logger
createLogger(config): Logger
```

**Design Choices:**

- **Mutable State**: Dashboard needs to modify probability/enabled at runtime. Using a shared state object instead of closures allows this.
  
- **Random Selection**: Chaos actions are selected randomly from enabled behaviors using `Math.random()`. No seedable RNG needed (this isn't for reproducible tests).

- **ANSI Escape Codes**: Hand-coded color codes instead of chalk dependency. Keeps bundle size minimal.

---

### 2. Adapters

#### Express Adapter (`adapters/express.ts`)

**Integration Points:**
- Express middleware signature: `(req, res, next) => void`
- Intercepts `res.send()`, `res.json()`, `res.end()` for mutations
- Uses async `sleep()` for latency (doesn't block event loop)

**Execution Flow:**
```
1. Dashboard route check → Serve UI or API
2. Request tracking (state.requestCount++)
3. Route matching → shouldFuzzRoute()
4. Rate limit check → checkRateLimit()
5. Probability check → shouldInjectChaos()
6. Action selection → selectChaosAction()
7. Execute chaos:
   - Latency → await sleep() then next()
   - Error → res.status().json()
   - Timeout → do nothing (hang forever)
   - BodyMutation → wrap res.send()
   - ZombieMode → wrap res.end()
   - HeaderHavoc → wrap res.json()
8. Call next() or return response
```

**Response Interception:**

For body mutation and zombie mode, we hijack Express response methods:

```typescript
const originalSend = res.send.bind(res);
res.send = function(body) {
  // Mutate body here
  return originalSend(mutatedBody);
};
next(); // Continue to actual handler
```

This allows chaos to happen **after** the handler runs but **before** the response is sent.

#### Next.js Adapter (`adapters/next.ts`)

**Two Modes:**

1. **App Router Middleware** (`fuzzboxNext`)
   - Edge Runtime compatible (mostly)
   - Limited streaming/header manipulation
   - Uses standard `Response` API

2. **Pages Router Wrapper** (`fuzzboxApiRoute`)
   - Wraps individual API route handlers
   - Full feature support (Node.js runtime)
   - Intercepts `res.json()` for mutations

**Edge Runtime Limitations:**

Zombie mode and advanced header manipulation don't work in Edge Runtime because:
- No access to Node.js `stream` module
- Limited control over response streaming
- Can't hold connections open indefinitely

For these features, use Pages Router or deploy to Node.js runtime.

---

### 3. Mutators

#### Body Mutator (`mutators/bodyMutator.ts`)

**Algorithm:**
```
mutateBody(value, fieldProbability):
  if value is primitive:
    if random() < fieldProbability:
      return corrupted value (undefined, -999, !bool)
  if value is array:
    return value.map(item => mutateBody(item))
  if value is object:
    return { k: mutateBody(v) for k,v in object }
```

Recursively walks JSON structures. Each field has `fieldProbability` chance of corruption.

**Why This Works:**

Frontend code often doesn't handle:
- Missing fields (`undefined` instead of string)
- Negative numbers where positive expected
- Boolean flips breaking conditional logic

This mutation strategy exposes those bugs quickly.

#### Header Mutator (`mutators/headerMutator.ts`)

**Actions:**

1. **Delete**: Remove a header entirely
   - Breaks CORS if `Access-Control-Allow-Origin` deleted
   
2. **Scramble**: Reverse header value
   - `Content-Type: application/json` → `nosj/noitacilppa`
   
3. **Alter**: Change header to wrong value
   - `Content-Type: application/json` → `text/plain`

**Random Selection:**

If `targetHeaders` is empty, picks a random header from the response. Otherwise, randomly picks from the target list.

#### Zombie Mode (`mutators/zombieMode.ts`)

**Implementation:**

```typescript
class ZombieStream extends Writable {
  private buffer: Buffer[];
  
  async drip(targetStream) {
    const fullBuffer = Buffer.concat(this.buffer);
    for (let i = 0; i < fullBuffer.length; i++) {
      targetStream.write(Buffer.from([fullBuffer[i]]));
      await sleep(1000 / bytesPerSecond);
    }
    targetStream.end();
  }
}
```

Collects the full response in memory, then streams it one byte at a time with delays.

**Trade-offs:**
- Memory: Buffers entire response (bad for large payloads)
- Simplicity: Easy to implement and understand
- Effectiveness: Forces client timeout logic to trigger

For production chaos engineering (e.g., Chaos Monkey), you'd want chunked streaming without buffering. For dev testing, this is fine.

---

### 4. Dashboard

**Architecture:**

Single HTML file with embedded CSS and vanilla JavaScript. No build step required.

**Components:**

1. **Stats Display**: Shows request count, chaos count, chaos rate
2. **Controls**: Toggle enable/disable, probability slider, spike mode button
3. **State Sync**: Polls `/__fuzzbox/api/state` every 2 seconds

**Why Vanilla JS:**

Zero build dependencies. The dashboard can be updated without reinstalling packages or rebuilding. It's truly zero-dependency at runtime.

**State Management:**

```javascript
let state = { enabled, probability, spikeMode, ... };

async function fetchState() {
  const res = await fetch('/__fuzzbox/api/state');
  state = await res.json();
  updateUI();
}

async function updateState(changes) {
  await fetch('/__fuzzbox/api/state', {
    method: 'POST',
    body: JSON.stringify(changes),
  });
  // Server returns updated state
}
```

Simple polling architecture. For a production monitoring tool, you'd use WebSockets. For a dev tool, polling every 2s is fine.

---

## Data Flow

### Request Lifecycle

```
HTTP Request
    ↓
Fuzzbox Middleware
    ↓
[1] Dashboard check → Return HTML/API
    ↓
[2] Route matching → Skip if excluded
    ↓
[3] Rate limit check → Return 429 if exceeded
    ↓
[4] Probability check → Skip if no chaos
    ↓
[5] Select chaos action
    ↓
[6] Execute chaos:
    ├─ Latency: await sleep() → next()
    ├─ Error: return error response
    ├─ Timeout: hang forever
    ├─ BodyMutation: intercept res.send() → next()
    ├─ ZombieMode: intercept res.end() → next()
    └─ HeaderHavoc: intercept res.json() → next()
    ↓
next() → Your Handler
    ↓
Response (possibly mutated)
    ↓
Client
```

### Dashboard Update Flow

```
User clicks "Spike Mode"
    ↓
JavaScript: POST /__fuzzbox/api/state { spikeMode: true }
    ↓
Fuzzbox Middleware: Intercepts POST
    ↓
Update state.spikeMode = true
Set state.spikeModeExpiry = Date.now() + 30000
    ↓
Return updated state as JSON
    ↓
JavaScript: Update UI to show "SPIKE MODE ACTIVE"
    ↓
Next request: shouldInjectChaos() uses 80% probability
    ↓
After 30 seconds: Expiry check clears spike mode
```

---

## Performance Characteristics

### Overhead Analysis

**When Chaos is NOT Triggered:**
```
Request → shouldFuzzRoute() → shouldInjectChaos() → next()
         (string comparison)  (Math.random() < prob)
         ~0.1ms               ~0.1ms
```

Total overhead: **<0.5ms** per request

**When Chaos is Triggered:**

| Action | Overhead |
|--------|----------|
| Latency | 100-3000ms (intentional delay) |
| Error | 1ms (immediate response) |
| Timeout | ∞ (intentional hang) |
| Body Mutation | 1-10ms (JSON parse/stringify) |
| Zombie Mode | Minutes (intentional slow drip) |
| Header Havoc | <1ms (string manipulation) |
| Rate Limit | <1ms (Map lookup) |

### Memory Usage

**Baseline:** ~1MB (middleware + state object)

**Per Request:**
- Normal: ~0KB (no allocations)
- Body Mutation: ~size of JSON response (cloned and mutated)
- Zombie Mode: ~size of full response (buffered)
- Dashboard: ~6KB HTML served

**State Growth:**
- Rate limit counter: ~100 bytes per unique client IP
- Auto-cleared after `windowMs` expires

### CPU Usage

Negligible. All chaos is either:
- Async delays (no CPU)
- String/JSON manipulation (minimal CPU)
- Random number generation (trivial)

No cryptographic operations, no complex algorithms.

---

## Security Architecture

**Threat Model:** Fuzzbox assumes:
1. Developer installing it is trusted
2. Environment is development/staging (not production)
3. Network is private (no external attackers)

**Attack Surface:**

1. **Dashboard**: Unauthenticated by default
   - Mitigation: Disable with `dashboardPath: null`
   
2. **Data Corruption**: Body mutation can break auth/session tokens
   - Mitigation: Use `excludeRoutes` for sensitive endpoints
   
3. **DoS**: Timeout/zombie mode can exhaust connections
   - Mitigation: Keep `probability` low, disable dangerous modes

**Not Designed For:**
- Protection against real attackers
- Production security
- Preventing abuse

**Is Designed For:**
- Testing frontend resilience
- Finding client-side bugs
- Chaos engineering in safe environments

---

## Extensibility

### Adding New Chaos Behaviors

1. **Add config interface** (`types.ts`):
   ```typescript
   interface NewBehaviorConfig {
     enabled?: boolean;
     setting?: number;
   }
   ```

2. **Update default config** (`core.ts`):
   ```typescript
   newBehavior: { enabled: true, setting: 100 }
   ```

3. **Add to chaos action selector** (`core.ts`):
   ```typescript
   if (config.behaviors.newBehavior.enabled) {
     enabledBehaviors.push(() => ({ type: 'newBehavior' }));
   }
   ```

4. **Implement in adapters** (`adapters/*.ts`):
   ```typescript
   case 'newBehavior':
     // Implementation
     break;
   ```

5. **Document in API.md** and update README

### Custom Adapters

To support other frameworks (Fastify, Koa, etc.):

```typescript
import { mergeConfig, createState, shouldFuzzRoute, ... } from 'fuzzbox/core';

export function fuzzboxFastify(userConfig) {
  const config = mergeConfig(userConfig);
  const state = createState();
  
  return async (req, reply) => {
    // Implement chaos logic using framework-specific APIs
  };
}
```

The core logic is framework-agnostic. Adapters just translate to framework-specific request/response handling.

---

## Testing Strategy

### Unit Tests (`tests/core.test.js`)

Test pure functions in `core.ts`:
- `mergeConfig()` - Config merging logic
- `shouldFuzzRoute()` - Route matching
- `shouldInjectChaos()` - Probability calculation
- `selectChaosAction()` - Action selection

### Mutator Tests (`tests/mutators.test.js`)

Test mutator functions:
- `mutateBody()` - JSON corruption
- `applyHeaderHavoc()` - Header manipulation
- `ZombieStream` - Slow drip behavior

### Integration Tests (`tests/integration.test.js`)

Test full middleware with mock Express/Next.js apps:
- Request/response interception
- Dashboard API
- Multi-behavior chaos scenarios

---

## Build Process

```
TypeScript Source (src/)
    ↓
tsup (build tool)
    ↓
├─ CommonJS (dist/index.js)
├─ ESM (dist/index.mjs)
└─ Type Definitions (dist/index.d.ts)
```

**Why tsup:**
- Zero config for dual ESM/CJS builds
- Fast (uses esbuild internally)
- Handles TypeScript declarations automatically

**Output Formats:**
- **CJS**: For older Node.js projects using `require()`
- **ESM**: For modern projects using `import`
- **TypeScript defs**: For type safety in TypeScript projects

---

## Changelog Philosophy

Fuzzbox follows these versioning rules:

- **Patch** (1.0.X): Bug fixes, no API changes
- **Minor** (1.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking API changes

Given the nature of the tool (chaos), "breaking changes" are interpreted loosely. If a new chaos behavior is added and enabled by default, that's considered minor (you can disable it).

---

## Future Improvements

Potential future features (not implemented yet):

1. **Request Body Fuzzing**: Mutate incoming JSON (not just responses)
2. **Network Simulation**: Introduce packet loss, reordering
3. **Time Travel**: Mess with Date.now() and setTimeout
4. **Memory Leaks**: Intentionally leak memory to test monitoring
5. **CPU Spikes**: Busy-loop to simulate high load
6. **Distributed Chaos**: Coordinate chaos across multiple services

These would require more dependencies or OS-level access, so they conflict with the "zero dependency" principle. Possible as separate packages or opt-in features.

---

## Why This Architecture

| Decision | Rationale |
|----------|-----------|
| Zero dependencies | Minimize supply chain risk, reduce bundle size |
| Mutable state | Dashboard needs runtime config changes |
| Middleware pattern | Integrates naturally with Express/Next.js |
| Vanilla JS dashboard | No build step, no dependencies |
| TypeScript strict | Catch bugs at compile time |
| Random chaos | Simpler than deterministic, good enough for dev testing |
| ANSI colors | No chalk dependency, works in all terminals |
| Single HTML dashboard | Easy to maintain, self-contained |

The entire architecture optimizes for:
1. **Simplicity**: Easy to understand and modify
2. **Zero dependencies**: No supply chain risk
3. **Developer ergonomics**: Works out of the box, minimal config
4. **Effectiveness**: Actually finds real bugs in frontends

Not optimized for:
1. Performance (chaos is slow by design)
2. Production use (this is a dev tool)
3. Extensibility (simple is better than flexible)

---

Built for developers who need to test resilience without learning a complex framework.
