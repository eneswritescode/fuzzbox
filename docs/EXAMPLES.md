# Fuzzbox Examples

Quick examples showing how to use Fuzzbox in different environments.

## Express.js Basic Setup

```typescript
import express from 'express';
import { fuzzboxExpress } from 'fuzzbox';

const app = express();
app.use(express.json());

// Add Fuzzbox middleware (10% chaos rate)
app.use(fuzzboxExpress({
  probability: 0.1,
  includeRoutes: ['/api/*'],
  excludeRoutes: ['/api/health'],
}));

app.get('/api/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] });
});

app.listen(3000);
// Visit http://localhost:3000/__fuzzbox for the control panel
```

## Next.js App Router Middleware

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

## Next.js API Route (Pages Router)

```typescript
// pages/api/users.ts
import { fuzzboxApiRoute } from 'fuzzbox';

async function handler(req, res) {
  res.status(200).json({ users: [] });
}

export default fuzzboxApiRoute(handler, {
  probability: 0.2,
  behaviors: {
    bodyMutation: { enabled: true, fieldProbability: 0.3 },
    errors: { enabled: true },
  },
});
```

## Advanced Configuration

```typescript
import { fuzzboxExpress } from 'fuzzbox';

app.use(fuzzboxExpress({
  probability: 0.25,
  includeRoutes: [/^\/api\/payments/],
  excludeRoutes: ['/api/health', '/api/metrics'],
  
  behaviors: {
    // Only latency and errors, disable everything else
    latency: { 
      enabled: true, 
      minMs: 500, 
      maxMs: 3000 
    },
    errors: { 
      enabled: true, 
      statusCodes: [500, 503, 504] 
    },
    timeout: { enabled: false },
    bodyMutation: { enabled: false },
    zombieMode: { enabled: false },
    headerHavoc: { enabled: false },
    rateLimit: { enabled: false },
  },
  
  // Custom logger
  logger: (message, level) => {
    console.log(`[Fuzzbox ${level.toUpperCase()}] ${message}`);
  },
}));
```
