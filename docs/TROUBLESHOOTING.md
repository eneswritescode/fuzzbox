# Troubleshooting

Common issues and solutions when using Fuzzbox.

## Installation Issues

### TypeScript errors during installation

**Problem:**
```
Cannot find module 'express' or its corresponding type declarations
Cannot find module 'next/server' or its corresponding type declarations
```

**Solution:**
These are peer dependencies. Fuzzbox only needs types if you're building it from source.

If using the published package:
```bash
npm install fuzzbox
# No need to install express or next unless you're using them
```

If building from source:
```bash
npm install --save-dev @types/express @types/node next
npm run build
```

### Build fails with "error occurred in dts build"

**Problem:**
```
DTS Build error
src/adapters/next.ts: Cannot find module 'next'
```

**Solution:**
Install Next.js as a dev dependency:
```bash
npm install --save-dev next
npm run build
```

This only affects building from source. Published package already includes compiled types.

---

## Runtime Issues

### Fuzzbox doesn't inject any chaos

**Problem:**
Middleware is installed but no chaos is happening.

**Checklist:**
1. Is Fuzzbox enabled?
   ```typescript
   app.use(fuzzboxExpress({ enabled: true }));
   ```

2. Is probability high enough?
   ```typescript
   app.use(fuzzboxExpress({ probability: 0.5 })); // Try 50% for testing
   ```

3. Is the route included?
   ```typescript
   // If you set includeRoutes, your path must match
   app.use(fuzzboxExpress({
     includeRoutes: ['/api/*'],
     // /api/users will be fuzzed
     // /users will NOT be fuzzed
   }));
   ```

4. Is the route excluded?
   ```typescript
   app.use(fuzzboxExpress({
     excludeRoutes: ['/api/users'],
     // /api/users will never be fuzzed
   }));
   ```

5. Check the logs:
   ```typescript
   app.use(fuzzboxExpress({ silent: false }));
   // Should see: 🎸 [Fuzzbox] Middleware initialized. Chaos is ready.
   ```

### Dashboard not loading

**Problem:**
`/__fuzzbox` returns 404.

**Solutions:**

1. **Check dashboardPath config:**
   ```typescript
   app.use(fuzzboxExpress({ 
     dashboardPath: '/__fuzzbox' // Must match URL
   }));
   ```

2. **Ensure middleware is registered before routes:**
   ```typescript
   // CORRECT:
   app.use(fuzzboxExpress());
   app.get('/api/users', handler);

   // WRONG:
   app.get('/api/users', handler);
   app.use(fuzzboxExpress()); // Too late, won't intercept
   ```

3. **Check for middleware conflicts:**
   ```typescript
   // If another middleware catches all routes, Fuzzbox won't run
   app.use((req, res) => res.send('Hello')); // BAD
   app.use(fuzzboxExpress()); // Never reached
   ```

### Dashboard shows 0 requests

**Problem:**
Dashboard loads but shows `requestCount: 0`.

**Cause:**
Your routes are excluded or Fuzzbox middleware isn't being hit.

**Solution:**
```typescript
// Remove excludeRoutes temporarily to test
app.use(fuzzboxExpress({
  includeRoutes: [], // Empty = fuzz all routes
  excludeRoutes: [], // No exclusions
}));
```

---

## Chaos Behavior Issues

### Latency injection doesn't work

**Problem:**
Responses are instant even with latency enabled.

**Debug:**
1. Check if latency is enabled:
   ```typescript
   behaviors: {
     latency: { enabled: true }
   }
   ```

2. Increase probability to guarantee chaos:
   ```typescript
   app.use(fuzzboxExpress({ probability: 1.0 })); // 100% chaos
   ```

3. Check logs for latency messages:
   ```
   🎸 [Fuzzbox] Injecting 1234ms latency to GET /api/users
   ```

4. Verify your handler isn't setting cache headers:
   ```typescript
   // If browser caches response, latency won't be visible
   res.setHeader('Cache-Control', 'no-cache');
   ```

### Body mutation doesn't change response

**Problem:**
JSON response still looks correct even with mutation enabled.

**Possible Causes:**

1. **Status code mismatch:**
   ```typescript
   behaviors: {
     bodyMutation: {
       enabled: true,
       statusCodes: [200], // Only mutates 200 responses
     }
   }
   // If your handler returns 201, mutation won't trigger
   ```

2. **Content-Type isn't JSON:**
   ```typescript
   // Mutation only works on Content-Type: application/json
   res.setHeader('Content-Type', 'application/json');
   res.json({ data }); // Will be mutated
   
   res.send('<html>'); // Won't be mutated (not JSON)
   ```

3. **Response is buffered:**
   ```typescript
   // Express may buffer and send before mutation intercepts
   // Try res.json() instead of res.send()
   ```

### Zombie mode causes server hangs

**Problem:**
After enabling zombie mode, server becomes unresponsive.

**Cause:**
Zombie mode holds connections open for minutes. If all workers are busy with zombie streams, new requests can't be processed.

**Solutions:**

1. **Lower zombie mode probability:**
   ```typescript
   behaviors: {
     zombieMode: {
       enabled: true,
       probability: 0.05, // Only 5% of chaos events
     }
   }
   ```

2. **Increase bytesPerSecond:**
   ```typescript
   behaviors: {
     zombieMode: {
       bytesPerSecond: 100, // Faster drip = shorter hang time
     }
   }
   ```

3. **Disable in development if causing issues:**
   ```typescript
   behaviors: {
     zombieMode: { enabled: false }
   }
   ```

---

## Next.js Specific Issues

### Middleware runs but chaos doesn't apply

**Problem (App Router):**
Next.js middleware catches request but chaos doesn't happen.

**Cause:**
You must return the chaos response, not just call the middleware.

**Wrong:**
```typescript
export async function middleware(req: NextRequest) {
  await fuzzboxNext()(req); // Returns Response, but you ignore it
  return NextResponse.next(); // Always passes through
}
```

**Correct:**
```typescript
export async function middleware(req: NextRequest) {
  const chaosResponse = await fuzzboxNext()(req);
  if (chaosResponse) return chaosResponse; // Return chaos response
  return NextResponse.next();
}
```

### Edge Runtime errors

**Problem:**
```
Error: Cannot find module 'stream'
Error: Buffer is not defined
```

**Cause:**
Zombie mode and some other features use Node.js built-ins not available in Edge Runtime.

**Solution:**
1. Disable incompatible features:
   ```typescript
   fuzzboxNext({
     behaviors: {
       zombieMode: { enabled: false },
       headerHavoc: { enabled: false },
     }
   })
   ```

2. Or use Node.js runtime instead:
   ```typescript
   // route.ts
   export const runtime = 'nodejs'; // Instead of 'edge'
   ```

### API Routes (Pages Router) don't see chaos

**Problem:**
`fuzzboxApiRoute()` wrapper doesn't inject chaos.

**Checklist:**

1. Did you wrap the handler?
   ```typescript
   // WRONG:
   export default async function handler(req, res) { ... }

   // CORRECT:
   const handler = async (req, res) => { ... };
   export default fuzzboxApiRoute(handler, { probability: 0.3 });
   ```

2. Is probability too low?
   ```typescript
   export default fuzzboxApiRoute(handler, { 
     probability: 1.0 // Test with 100% first
   });
   ```

3. Check server logs for chaos messages.

---

## Express Specific Issues

### Middleware order matters

**Problem:**
Some routes are fuzzed, others aren't.

**Cause:**
Middleware runs in order. If a route handler comes before Fuzzbox, it won't be fuzzed.

**Example:**
```typescript
// Route defined before Fuzzbox
app.get('/early', (req, res) => res.send('OK')); // NOT fuzzed

app.use(fuzzboxExpress());

// Route defined after Fuzzbox
app.get('/late', (req, res) => res.send('OK')); // IS fuzzed
```

**Solution:**
Always register Fuzzbox **before** your route handlers:
```typescript
const app = express();

// Middleware first
app.use(express.json());
app.use(fuzzboxExpress());

// Then routes
app.get('/api/users', handler);
```

### JSON parsing errors

**Problem:**
```
SyntaxError: Unexpected token u in JSON at position 0
```

**Cause:**
Body mutation is changing strings to `undefined`, which isn't valid JSON when stringified.

**Why This Happens:**
```typescript
// Original response
{ "name": "Alice" }

// After mutation
{ "name": undefined } // Invalid JSON!

// When stringified
'{"name":undefined}' // Not valid JSON
```

**This is intentional.** The point is to break things and see if your client handles it gracefully.

**To fix client-side:**
```typescript
// Client code should handle parse errors
try {
  const data = await res.json();
} catch (err) {
  console.error('Invalid JSON from API:', err);
  // Fallback behavior
}
```

**To reduce frequency:**
```typescript
behaviors: {
  bodyMutation: {
    fieldProbability: 0.1, // Lower mutation rate
  }
}
```

---

## Dashboard Issues

### Dashboard API returns errors

**Problem:**
POST to `/__fuzzbox/api/state` returns 400 or 500.

**Common Causes:**

1. **No body parser middleware:**
   ```typescript
   // Express needs this to parse JSON
   app.use(express.json());
   app.use(fuzzboxExpress());
   ```

2. **Invalid JSON in request:**
   ```javascript
   // Client code
   fetch('/__fuzzbox/api/state', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ probability: 0.5 }), // Must be valid JSON
   });
   ```

3. **CORS issues:**
   If dashboard is loaded from different origin:
   ```typescript
   app.use(cors()); // Allow cross-origin requests
   app.use(fuzzboxExpress());
   ```

### Spike mode doesn't trigger

**Problem:**
Click "Activate Spike Mode" but chaos rate doesn't increase.

**Debug:**

1. Check browser console for errors:
   ```
   F12 → Console → Look for fetch errors
   ```

2. Verify POST request succeeds:
   ```javascript
   // Should return updated state with spikeMode: true
   { "enabled": true, "spikeMode": true, ... }
   ```

3. Check server logs:
   ```
   🎸 [Fuzzbox] SPIKE MODE ACTIVATED: 80% chaos for 30 seconds
   ```

4. Make some requests immediately after activating:
   ```bash
   # Spike mode only lasts 30 seconds
   curl http://localhost:3000/api/test
   curl http://localhost:3000/api/test
   # Should see ~80% of requests get chaos
   ```

---

## Performance Issues

### Server becomes slow after enabling Fuzzbox

**Problem:**
Response times increase even when chaos isn't triggered.

**Diagnostic:**

1. **Check probability overhead:**
   Per-request overhead should be <1ms. If it's higher, something's wrong.

2. **Disable behaviors one by one:**
   ```typescript
   behaviors: {
     latency: { enabled: false },
     errors: { enabled: false },
     // ... disable all
   }
   // Re-enable one at a time to find culprit
   ```

3. **Check for memory leaks:**
   ```bash
   node --inspect server.js
   # Open chrome://inspect
   # Take heap snapshots before/after requests
   ```

### High memory usage

**Problem:**
Node.js process memory keeps growing.

**Possible Causes:**

1. **Zombie mode buffering:**
   Each zombie stream buffers the entire response.
   ```typescript
   // With 100 concurrent zombie streams, each with 1MB response
   // = 100MB buffered in memory
   behaviors: {
     zombieMode: { 
       enabled: false, // Disable if memory is an issue
     }
   }
   ```

2. **Rate limit counter growth:**
   Map stores IP addresses and timestamps.
   ```typescript
   // Normally auto-cleaned, but if windowMs is very long...
   behaviors: {
     rateLimit: {
       windowMs: 60000, // Keep this reasonable
     }
   }
   ```

3. **Dashboard polling:**
   If many dashboard instances are open, polling every 2s can add up.
   Close unused dashboard tabs.

---

## Debugging Tips

### Enable verbose logging

```typescript
app.use(fuzzboxExpress({
  silent: false, // Ensure logging is on
  logger: (msg, level) => {
    console.log(`[${level.toUpperCase()}] ${msg}`);
  },
}));
```

### Test with 100% chaos

```typescript
// Temporarily set probability to 1.0 to ensure chaos happens
app.use(fuzzboxExpress({ probability: 1.0 }));
```

### Isolate behaviors

```typescript
// Enable only ONE behavior to debug
app.use(fuzzboxExpress({
  behaviors: {
    latency: { enabled: true },
    errors: { enabled: false },
    timeout: { enabled: false },
    bodyMutation: { enabled: false },
    zombieMode: { enabled: false },
    headerHavoc: { enabled: false },
    rateLimit: { enabled: false },
  },
}));
```

### Use dashboard for live debugging

Open `/__fuzzbox` and watch:
- Request count increases → Middleware is running
- Chaos count increases → Chaos is being injected
- Chaos rate % → Verify it matches your probability

### Check middleware order

```typescript
app._router.stack.forEach((middleware) => {
  console.log(middleware.name || 'anonymous');
});
// Fuzzbox should appear before your route handlers
```

---

## Common Mistakes

### ❌ Installing in production

```typescript
// DO NOT DO THIS
if (process.env.NODE_ENV === 'production') {
  app.use(fuzzboxExpress()); // NOOOO
}
```

**Solution:**
Only enable in development/staging:
```typescript
if (process.env.NODE_ENV !== 'production') {
  app.use(fuzzboxExpress());
}
```

### ❌ Setting probability too high

```typescript
// This will break EVERY request
app.use(fuzzboxExpress({ probability: 0.9 })); // 90% failure rate
```

**Solution:**
Start low (5-20%) and increase gradually:
```typescript
app.use(fuzzboxExpress({ probability: 0.1 })); // 10% is reasonable
```

### ❌ Not excluding critical endpoints

```typescript
// Health checks failing breaks monitoring
app.use(fuzzboxExpress()); // Fuzzes /health endpoint
```

**Solution:**
Always exclude monitoring/health endpoints:
```typescript
app.use(fuzzboxExpress({
  excludeRoutes: ['/health', '/metrics', '/ready'],
}));
```

### ❌ Expecting deterministic chaos

Fuzzbox is random. If you need reproducible test scenarios, write unit tests instead.

### ❌ Using in CI/CD without care

```yaml
# This will cause random test failures
- run: npm test
  env:
    FUZZBOX_ENABLED: true # BAD
```

**Solution:**
Control chaos explicitly in tests:
```typescript
// test-setup.js
process.env.FUZZBOX_PROBABILITY = '0'; // Disable chaos in tests
```

---

## Getting Help

If you're still stuck:

1. **Check logs** for chaos activity
2. **Simplify config** to minimal reproduction
3. **Test with curl** to eliminate browser caching:
   ```bash
   curl -v http://localhost:3000/api/test
   ```
4. **Check GitHub Issues** for similar problems
5. **Open an issue** with:
   - Fuzzbox version
   - Node.js version
   - Framework (Express/Next.js) version
   - Minimal reproduction steps
   - Error messages and logs

---

## Known Limitations

1. **Edge Runtime**: Zombie mode and some header havoc don't work
2. **GraphQL**: Body mutation will likely break GraphQL responses
3. **Binary responses**: Mutation only works on JSON
4. **Streaming responses**: Zombie mode buffers entire response
5. **WebSockets**: Not supported (only HTTP)

These are design limitations, not bugs. For advanced chaos testing, consider dedicated tools like Chaos Mesh or Litmus.

Fuzzbox is optimized for simple HTTP API testing, not complex distributed systems.
