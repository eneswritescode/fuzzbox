import type { NextRequest, NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { FuzzboxConfig } from '../types';
import {
  mergeConfig,
  createState,
  shouldFuzzRoute,
  shouldInjectChaos,
  selectChaosAction,
  checkRateLimit,
  createLogger,
  sleep,
} from '../core';
import { mutateBody } from '../mutators/bodyMutator';
import { dashboardHTML } from '../dashboard/template';

/**
 * Next.js middleware (App Router) for Fuzzbox.
 * Use this in middleware.ts for App Router or route handlers.
 */
export function fuzzboxNext(userConfig: FuzzboxConfig = {}) {
  const config = mergeConfig(userConfig);
  const state = createState();
  const logger = createLogger(config);

  state.enabled = config.enabled;
  state.probability = config.probability;

  logger.info('Next.js middleware initialized. Chaos is ready.');

  return async (req: NextRequest): Promise<NextResponse | Response | void> => {
    const pathname = req.nextUrl.pathname;

    // Serve dashboard UI
    if (config.dashboardPath && pathname === config.dashboardPath) {
      return new Response(dashboardHTML, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Dashboard API: Get state
    if (config.dashboardPath && pathname === `${config.dashboardPath}/api/state` && req.method === 'GET') {
      return Response.json({
        enabled: state.enabled,
        probability: state.probability,
        spikeMode: state.spikeMode,
        requestCount: state.requestCount,
        chaosCount: state.chaosCount,
      });
    }

    // Dashboard API: Update state
    if (config.dashboardPath && pathname === `${config.dashboardPath}/api/state` && req.method === 'POST') {
      const updates = (await req.json()) as any;

      if (typeof updates.enabled === 'boolean') {
        state.enabled = updates.enabled;
        logger.info(`Fuzzbox ${updates.enabled ? 'enabled' : 'disabled'} via dashboard`);
      }

      if (typeof updates.probability === 'number') {
        state.probability = Math.max(0, Math.min(1, updates.probability));
        logger.info(`Chaos probability set to ${Math.round(state.probability * 100)}%`);
      }

      if (updates.spikeMode === true) {
        state.spikeMode = true;
        state.spikeModeExpiry = Date.now() + 30000;
        logger.warn('SPIKE MODE ACTIVATED: 80% chaos for 30 seconds');
      }

      if (updates.reset === true) {
        state.requestCount = 0;
        state.chaosCount = 0;
        state.rateLimitCounter.clear();
        logger.info('Stats reset');
      }

      return Response.json({
        enabled: state.enabled,
        probability: state.probability,
        spikeMode: state.spikeMode,
        requestCount: state.requestCount,
        chaosCount: state.chaosCount,
      });
    }

    // Track request
    state.requestCount++;

    // Check if route should be fuzzed
    if (!shouldFuzzRoute(pathname, config.includeRoutes, config.excludeRoutes)) {
      return;
    }

    // Check rate limiting
    const clientId = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
    if (checkRateLimit(state, config, clientId)) {
      state.chaosCount++;
      logger.error(`429 Too Many Requests returned to ${req.method} ${pathname}`);
      return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': config.behaviors.rateLimit.retryAfterSeconds.toString(),
        },
      });
    }

    // Decide if chaos should be injected
    if (!shouldInjectChaos(state)) {
      return;
    }

    // Select chaos action
    const action = selectChaosAction(config);
    state.chaosCount++;

    // Execute chaos action
    switch (action.type) {
      case 'latency':
        logger.warn(`Injecting ${action.delayMs}ms latency to ${req.method} ${pathname}`);
        await sleep(action.delayMs);
        return;

      case 'error':
        logger.error(`${action.statusCode} error injected to ${req.method} ${pathname}`);
        return new Response(JSON.stringify({ error: 'Fuzzbox chaos error' }), {
          status: action.statusCode,
          headers: { 'Content-Type': 'application/json' },
        });

      case 'timeout':
        logger.error(`Request timeout (infinite hang) applied to ${req.method} ${pathname}`);
        // Hang forever
        await new Promise(() => {});
        return;

      case 'bodyMutation':
        logger.warn(`Body mutation enabled for ${req.method} ${pathname}`);
        // Body mutation in Next.js middleware is tricky; better handled in API routes
        // For now, we'll skip or implement in wrapper function
        return;

      case 'zombieMode':
        logger.warn(`Zombie mode (slow drip) activated for ${req.method} ${pathname}`);
        // Zombie mode in edge runtime is complex; skip for now
        return;

      case 'headerHavoc':
        logger.warn(`Header havoc (${action.action}) applied to ${req.method} ${pathname}`);
        // Skip in middleware, better in response modification
        return;

      default:
        return;
    }
  };
}

/**
 * Next.js API route wrapper (Pages Router) for Fuzzbox.
 * Wraps an API route handler with chaos injection.
 */
export function fuzzboxApiRoute(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void,
  userConfig: FuzzboxConfig = {}
) {
  const config = mergeConfig(userConfig);
  const state = createState();
  const logger = createLogger(config);

  state.enabled = config.enabled;
  state.probability = config.probability;

  return async (req: NextApiRequest, res: NextApiResponse) => {
    const pathname = req.url || '';

    // Track request
    state.requestCount++;

    // Check if route should be fuzzed
    if (!shouldFuzzRoute(pathname, config.includeRoutes, config.excludeRoutes)) {
      return handler(req, res);
    }

    // Check rate limiting
    const clientId = req.socket.remoteAddress || 'unknown';
    if (checkRateLimit(state, config, clientId)) {
      state.chaosCount++;
      logger.error(`429 Too Many Requests returned to ${req.method} ${pathname}`);
      res.setHeader('Retry-After', config.behaviors.rateLimit.retryAfterSeconds.toString());
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    // Decide if chaos should be injected
    if (!shouldInjectChaos(state)) {
      return handler(req, res);
    }

    // Select chaos action
    const action = selectChaosAction(config);
    state.chaosCount++;

    // Execute chaos action
    switch (action.type) {
      case 'latency':
        logger.warn(`Injecting ${action.delayMs}ms latency to ${req.method} ${pathname}`);
        await sleep(action.delayMs);
        return handler(req, res);

      case 'error':
        logger.error(`${action.statusCode} error injected to ${req.method} ${pathname}`);
        return res.status(action.statusCode).json({ error: 'Fuzzbox chaos error' });

      case 'timeout':
        logger.error(`Request timeout (infinite hang) applied to ${req.method} ${pathname}`);
        // Do nothing, hang forever
        return;

      case 'bodyMutation':
        logger.warn(`Body mutation enabled for ${req.method} ${pathname}`);
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
          if (config.behaviors.bodyMutation.statusCodes.includes(res.statusCode || 200)) {
            const mutated = mutateBody(body, config.behaviors.bodyMutation.fieldProbability);
            return originalJson(mutated);
          }
          return originalJson(body);
        };
        await handler(req, res);
        return;

      default:
        await handler(req, res);
        return;
    }
  };
}
