import type { Request, Response, NextFunction } from 'express';
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
import { mutateBody, tryParseJSON } from '../mutators/bodyMutator';
import { applyHeaderHavoc } from '../mutators/headerMutator';
import { ZombieStream } from '../mutators/zombieMode';
import { dashboardHTML } from '../dashboard/template';

/**
 * Express middleware for Fuzzbox.
 * Intercepts requests and injects chaos based on configuration.
 */
export function fuzzboxExpress(userConfig: FuzzboxConfig = {}) {
  const config = mergeConfig(userConfig);
  const state = createState();
  const logger = createLogger(config);

  // Sync state with config
  state.enabled = config.enabled;
  state.probability = config.probability;

  logger.info('Middleware initialized. Chaos is ready.');

  return (req: Request, res: Response, next: NextFunction) => {
    // Serve dashboard UI
    if (config.dashboardPath && req.path === config.dashboardPath) {
      res.setHeader('Content-Type', 'text/html');
      return res.send(dashboardHTML);
    }

    // Dashboard API: Get state
    if (config.dashboardPath && req.path === `${config.dashboardPath}/api/state` && req.method === 'GET') {
      return res.json({
        enabled: state.enabled,
        probability: state.probability,
        spikeMode: state.spikeMode,
        requestCount: state.requestCount,
        chaosCount: state.chaosCount,
      });
    }

    // Dashboard API: Update state
    if (config.dashboardPath && req.path === `${config.dashboardPath}/api/state` && req.method === 'POST') {
      const updates = req.body;

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
        state.spikeModeExpiry = Date.now() + 30000; // 30 seconds
        logger.warn('SPIKE MODE ACTIVATED: 80% chaos for 30 seconds');
      }

      if (updates.reset === true) {
        state.requestCount = 0;
        state.chaosCount = 0;
        state.rateLimitCounter.clear();
        logger.info('Stats reset');
      }

      return res.json({
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
    if (!shouldFuzzRoute(req.path, config.includeRoutes, config.excludeRoutes)) {
      return next();
    }

    // Check rate limiting
    const clientId = req.ip || 'unknown';
    if (checkRateLimit(state, config, clientId)) {
      state.chaosCount++;
      logger.error(`429 Too Many Requests returned to ${req.method} ${req.path}`);
      res.setHeader('Retry-After', config.behaviors.rateLimit.retryAfterSeconds.toString());
      return res.status(429).json({ error: 'Too Many Requests' });
    }

    // Decide if chaos should be injected
    if (!shouldInjectChaos(state)) {
      return next();
    }

    // Select chaos action
    const action = selectChaosAction(config);
    state.chaosCount++;

    // Execute chaos action
    switch (action.type) {
      case 'latency':
        logger.warn(`Injecting ${action.delayMs}ms latency to ${req.method} ${req.path}`);
        sleep(action.delayMs).then(() => next());
        return;

      case 'error':
        logger.error(`${action.statusCode} error injected to ${req.method} ${req.path}`);
        return res.status(action.statusCode).json({ error: 'Fuzzbox chaos error' });

      case 'timeout':
        logger.error(`Request timeout (infinite hang) applied to ${req.method} ${req.path}`);
        // Do nothing. The request will hang forever.
        return;

      case 'bodyMutation':
        logger.warn(`Body mutation enabled for ${req.method} ${req.path}`);
        // Intercept the response
        const originalSend = res.send.bind(res);
        res.send = function (body: any): Response {
          if (config.behaviors.bodyMutation.statusCodes.includes(res.statusCode)) {
            const contentType = res.getHeader('content-type');
            if (typeof contentType === 'string' && contentType.includes('application/json')) {
              const parsed = typeof body === 'string' ? tryParseJSON(body) : body;
              if (parsed) {
                const mutated = mutateBody(parsed, config.behaviors.bodyMutation.fieldProbability);
                return originalSend(JSON.stringify(mutated));
              }
            }
          }
          return originalSend(body);
        };
        next();
        return;

      case 'zombieMode':
        logger.warn(`Zombie mode (slow drip) activated for ${req.method} ${req.path}`);
        // Intercept response and stream it slowly
        const zombieStream = new ZombieStream(config.behaviors.zombieMode.bytesPerSecond, () => {});
        
        res.end = function (_chunk?: any, _encoding?: any, _callback?: any): Response {
          if (_chunk) {
            zombieStream.write(_chunk);
          }
          zombieStream.end();
          zombieStream.drip(res);
          return res;
        };
        next();
        return;

      case 'headerHavoc':
        logger.warn(`Header havoc (${action.action}) applied to ${req.method} ${req.path}`);
        const originalJson = res.json.bind(res);
        res.json = function (body: any): Response {
          const currentHeaders: Record<string, string | string[]> = {};
          res.getHeaderNames().forEach((name: string) => {
            const value = res.getHeader(name);
            if (value !== undefined) {
              currentHeaders[name] = value as string | string[];
            }
          });

          const modifiedHeaders = applyHeaderHavoc(currentHeaders, action.action, action.header);
          
          // Clear existing headers and set modified ones
          res.getHeaderNames().forEach((name: string) => res.removeHeader(name));
          Object.entries(modifiedHeaders).forEach(([key, value]) => {
            res.setHeader(key, value);
          });

          return originalJson(body);
        };
        next();
        return;

      default:
        next();
        return;
    }
  };
}
