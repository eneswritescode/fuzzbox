# 🎸 Fuzzbox

Chaos engineering and API fuzzing middleware for Node.js (Express) and Next.js. Intentionally break things before your users do.

Zero runtime dependencies. Just controlled mayhem.

## Why This Exists

Your frontend probably crashes when the API returns unexpected data. Your timeout logic is probably untested. Your error handling is probably optimistic at best.

Fuzzbox injects controlled chaos into HTTP responses—random latency, corrupted JSON, fake 500 errors, infinite hangs—so you can test whether your client code can actually handle the real world. Think of it as a terrible API simulation layer that runs in development.

It's 3 AM insurance.

## Features

- **Latency Injection**: Random delays (100ms - 3000ms by default) to test loading states and race conditions.
- **Error Fuzzing**: Randomly throw 500, 502, 503, 504 errors to validate error boundaries.
- **Timeout Simulation**: Hold requests forever without responding. Does your client give up gracefully?
- **Body Mutation**: Corrupt JSON responses by changing strings to `undefined`, numbers to `-999`, booleans to their opposite. Watch your frontend parse the chaos.
- **Zombie Mode**: Stream responses back one byte at a time (configurable drip rate). Tests client timeout logic.
- **Header Havoc**: Scramble, delete, or alter response headers (like breaking CORS or changing `Content-Type`).
- **Rate Limit Simulation**: Fake `429 Too Many Requests` with proper `Retry-After` headers.
- **Live Dashboard**: A built-in web UI at `/__fuzzbox` that lets you adjust chaos probability, trigger spike mode (80% failure for 30 seconds), and reset stats—all without restarting your server.

Zero external runtime dependencies. Uses only Node.js built-ins and ANSI escape codes for colorized logs.

## Installation

\`\`\`bash
npm install fuzzbox
\`\`\`

Or if you prefer the other one:

\`\`\`bash
yarn add fuzzbox
pnpm add fuzzbox
\`\`\`

## Usage

### Express.js

\`\`\`typescript
import express from 'express';
import { fuzzboxExpress } from 'fuzzbox';

const app = express();

// Add Fuzzbox middleware early in your stack
app.use(fuzzboxExpress({
  probability: 0.2,  // 20% of requests get fuzzed
  includeRoutes: ['/api/*'],  // Only fuzz /api/* routes
  excludeRoutes: ['/api/health'],  // Never fuzz health checks
}));

app.get('/api/users', (req, res) => {
  res.json({ users: [{ id: 1, name: 'Alice' }] });
});

app.listen(3000, () => console.log('Server running on :3000'));
\`\`\`

Visit `http://localhost:3000/__fuzzbox` to open the live control panel.

### Next.js (App Router)

Create or modify `middleware.ts` in your project root:

\`\`\`typescript
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
  
  // If Fuzzbox returns a response, use it; otherwise continue
  if (chaosResponse) {
    return chaosResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
\`\`\`

### Next.js (Pages Router / API Routes)

Wrap individual API route handlers:

\`\`\`typescript
// pages/api/users.ts
import { fuzzboxApiRoute } from 'fuzzbox';
import type { NextApiRequest, NextApiResponse } from 'next';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ users: [{ id: 1, name: 'Alice' }] });
}

export default fuzzboxApiRoute(handler, {
  probability: 0.2,
  behaviors: {
    bodyMutation: { enabled: true, fieldProbability: 0.4 },
    errors: { enabled: true },
    latency: { enabled: true, minMs: 200, maxMs: 2000 },
  },
});
\`\`\`

## Configuration

All options are optional. Sane (chaotic) defaults are provided.

\`\`\`typescript
interface FuzzboxConfig {
  /** Probability (0-1) that any given request gets fuzzed. Default: 0.1 (10%) */
  probability?: number;

  /** Enable/disable Fuzzbox entirely. Default: true */
  enabled?: boolean;

  /** Only fuzz routes matching these patterns. Empty = fuzz all. */
  includeRoutes?: (string | RegExp)[];

  /** Never fuzz routes matching these patterns. Takes precedence. */
  excludeRoutes?: (string | RegExp)[];

  /** Path for the live dashboard. Set to null to disable. Default: '/__fuzzbox' */
  dashboardPath?: string | null;

  /** Disable console logging. Default: false */
  silent?: boolean;

  /** Custom logger function */
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;

  /** Chaos behavior configuration */
  behaviors?: {
    latency?: {
      enabled?: boolean;
      minMs?: number;  // Default: 100
      maxMs?: number;  // Default: 3000
    };
    errors?: {
      enabled?: boolean;
      statusCodes?: number[];  // Default: [500, 502, 503, 504]
    };
    timeout?: {
      enabled?: boolean;
      probability?: number;  // Default: 0.2 (20% within chaos injection)
    };
    bodyMutation?: {
      enabled?: boolean;
      statusCodes?: number[];  // Default: [200]
      fieldProbability?: number;  // Default: 0.3 (30% chance per field)
    };
    zombieMode?: {
      enabled?: boolean;
      bytesPerSecond?: number;  // Default: 10
      probability?: number;  // Default: 0.1
    };
    headerHavoc?: {
      enabled?: boolean;
      targetHeaders?: string[];  // Empty = random headers
    };
    rateLimit?: {
      enabled?: boolean;
      requestLimit?: number;  // Default: 10 requests
      windowMs?: number;  // Default: 60000 (1 minute)
      retryAfterSeconds?: number;  // Default: 60
    };
  };
}
\`\`\`

## Examples

### Only fuzz payment endpoints with high error rates

\`\`\`typescript
app.use(fuzzboxExpress({
  probability: 0.5,
  includeRoutes: [/^\\/api\\/payments/],
  behaviors: {
    errors: { enabled: true, statusCodes: [500, 503] },
    latency: { enabled: false },
  },
}));
\`\`\`

### Test aggressive body mutation on all 200 responses

\`\`\`typescript
app.use(fuzzboxExpress({
  probability: 0.3,
  behaviors: {
    bodyMutation: { enabled: true, fieldProbability: 0.5 },
    errors: { enabled: false },
    latency: { enabled: false },
  },
}));
\`\`\`

### Simulate slow network conditions

\`\`\`typescript
app.use(fuzzboxExpress({
  probability: 0.8,
  behaviors: {
    latency: { enabled: true, minMs: 2000, maxMs: 5000 },
    zombieMode: { enabled: true, bytesPerSecond: 5, probability: 0.2 },
  },
}));
\`\`\`

## Live Dashboard

The dashboard is served at `/__fuzzbox` by default (configurable via \`dashboardPath\`).

Features:
- Real-time stats: total requests, chaos injected, chaos rate percentage.
- Toggle Fuzzbox on/off without restarting.
- Adjust chaos probability with a slider (0-100%).
- **Spike Mode**: Instantly set chaos rate to 80% for 30 seconds. Useful for load testing or simulating outages.
- Reset stats.

The dashboard is a single HTML file with embedded CSS and vanilla JavaScript. No build step, no external dependencies.

## Terminal Logs

Fuzzbox logs every chaos action with colorized ANSI output:

\`\`\`
🎸 [Fuzzbox] Middleware initialized. Chaos is ready.
🎸 [Fuzzbox] Injecting 1847ms latency to GET /api/users
🎸 [Fuzzbox] 502 error injected to POST /api/orders
🎸 [Fuzzbox] Body mutation enabled for GET /api/products
\`\`\`

Set \`silent: true\` to disable logs, or provide a custom \`logger\` function.

## FAQ

**Q: Should I use this in production?**  
A: Only if you hate your users. This is for development and staging environments.

**Q: Does this work with serverless functions?**  
A: Yes, but behavior may vary depending on the runtime. Edge runtimes have limitations (zombie mode and some stream-based chaos won't work).

**Q: Can I use this with other frameworks (Fastify, Koa, etc.)?**  
A: The Express adapter should work with most Connect-compatible middleware stacks. Next.js adapter is specific to Next.js.

**Q: Why "Fuzzbox"?**  
A: A fuzz pedal distorts guitar signals. This distorts API responses. Both make things worse on purpose.

## TypeScript

Fully typed. All configuration options and exports include TypeScript definitions.

## Documentation

Detailed guides and references:

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- **[API Reference](docs/API.md)** - Complete configuration options and TypeScript types
- **[Examples](docs/EXAMPLES.md)** - Real-world usage patterns and recipes
- **[Architecture](docs/ARCHITECTURE.md)** - Internal design and how Fuzzbox works
- **[Security](SECURITY.md)** - Threat model, warnings, and responsible chaos testing
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and debugging tips
- **[Contributing](CONTRIBUTING.md)** - Guidelines for contributors

## Tests

Run the test suite to verify core functionality:

\`\`\`bash
# Run all tests
node tests/core.test.js
node tests/mutators.test.js
node tests/integration.test.js

# Or run them all at once
npm test
\`\`\`

Tests use Node.js built-in \`assert\` module. Zero test dependencies.

## License

MIT. Break things responsibly.

## Contributing

PRs welcome. Keep dependencies at zero. Keep the tone direct.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

Built because watching production servers fail at 3 AM gets old.
