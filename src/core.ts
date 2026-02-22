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
} from './types';

/**
 * ANSI escape codes for colorized terminal output.
 * No chalk dependency needed when you know the dark arts.
 */
export const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

/**
 * Default configuration values.
 * Sane defaults for when you just want to watch the world burn a little.
 */
export const defaultConfig: Required<Omit<FuzzboxConfig, 'logger' | 'behaviors'>> & {
  behaviors: Required<{
    latency: Required<LatencyConfig>;
    errors: Required<ErrorConfig>;
    timeout: Required<TimeoutConfig>;
    bodyMutation: Required<BodyMutationConfig>;
    zombieMode: Required<ZombieModeConfig>;
    headerHavoc: Required<HeaderHavocConfig>;
    rateLimit: Required<RateLimitConfig>;
  }>;
} = {
  probability: 0.1,
  enabled: true,
  includeRoutes: [],
  excludeRoutes: [],
  dashboardPath: '/__fuzzbox',
  silent: false,
  behaviors: {
    latency: {
      enabled: true,
      minMs: 100,
      maxMs: 3000,
    },
    errors: {
      enabled: true,
      statusCodes: [500, 502, 503, 504],
    },
    timeout: {
      enabled: true,
      probability: 0.2,
    },
    bodyMutation: {
      enabled: true,
      statusCodes: [200],
      fieldProbability: 0.3,
    },
    zombieMode: {
      enabled: true,
      bytesPerSecond: 10,
      probability: 0.1,
    },
    headerHavoc: {
      enabled: true,
      targetHeaders: [],
    },
    rateLimit: {
      enabled: true,
      requestLimit: 10,
      windowMs: 60000,
      retryAfterSeconds: 60,
    },
  },
};

/**
 * Merge user config with defaults.
 * Deep merge for nested behavior configs.
 */
export function mergeConfig(userConfig: FuzzboxConfig) {
  const merged: any = { ...defaultConfig, ...userConfig };

  if (userConfig.behaviors) {
    merged.behaviors = {
      latency: { ...defaultConfig.behaviors.latency, ...userConfig.behaviors.latency },
      errors: { ...defaultConfig.behaviors.errors, ...userConfig.behaviors.errors },
      timeout: { ...defaultConfig.behaviors.timeout, ...userConfig.behaviors.timeout },
      bodyMutation: { ...defaultConfig.behaviors.bodyMutation, ...userConfig.behaviors.bodyMutation },
      zombieMode: { ...defaultConfig.behaviors.zombieMode, ...userConfig.behaviors.zombieMode },
      headerHavoc: { ...defaultConfig.behaviors.headerHavoc, ...userConfig.behaviors.headerHavoc },
      rateLimit: { ...defaultConfig.behaviors.rateLimit, ...userConfig.behaviors.rateLimit },
    };
  }

  return merged as typeof defaultConfig & { logger?: FuzzboxConfig['logger'] };
}

/**
 * Global mutable state.
 * The dashboard mutates this dynamically, because life is too short for immutability.
 */
export function createState(): FuzzboxState {
  return {
    enabled: true,
    probability: 0.1,
    spikeMode: false,
    spikeModeExpiry: null,
    requestCount: 0,
    chaosCount: 0,
    rateLimitCounter: new Map(),
  };
}

/**
 * Check if a route should be fuzzed based on include/exclude patterns.
 */
export function shouldFuzzRoute(
  path: string,
  includeRoutes: (string | RegExp)[],
  excludeRoutes: (string | RegExp)[]
): boolean {
  // Exclude takes precedence
  for (const pattern of excludeRoutes) {
    if (typeof pattern === 'string' && path.startsWith(pattern)) return false;
    if (pattern instanceof RegExp && pattern.test(path)) return false;
  }

  // If no include patterns, fuzz everything
  if (includeRoutes.length === 0) return true;

  // Check include patterns
  for (const pattern of includeRoutes) {
    if (typeof pattern === 'string' && path.startsWith(pattern)) return true;
    if (pattern instanceof RegExp && pattern.test(path)) return true;
  }

  return false;
}

/**
 * Decide whether to inject chaos based on probability and spike mode.
 */
export function shouldInjectChaos(state: FuzzboxState): boolean {
  if (!state.enabled) return false;

  // Check spike mode expiry
  if (state.spikeMode && state.spikeModeExpiry && Date.now() > state.spikeModeExpiry) {
    state.spikeMode = false;
    state.spikeModeExpiry = null;
  }

  const effectiveProbability = state.spikeMode ? 0.8 : state.probability;
  return Math.random() < effectiveProbability;
}

/**
 * Select a random chaos action based on enabled behaviors.
 */
export function selectChaosAction(config: ReturnType<typeof mergeConfig>): ChaosAction {
  const enabledBehaviors: (() => ChaosAction)[] = [];

  if (config.behaviors.latency.enabled) {
    enabledBehaviors.push(() => ({
      type: 'latency',
      delayMs: randomInt(config.behaviors.latency.minMs, config.behaviors.latency.maxMs),
    }));
  }

  if (config.behaviors.errors.enabled) {
    enabledBehaviors.push(() => ({
      type: 'error',
      statusCode: randomChoice(config.behaviors.errors.statusCodes),
    }));
  }

  if (config.behaviors.timeout.enabled && Math.random() < config.behaviors.timeout.probability) {
    enabledBehaviors.push(() => ({ type: 'timeout' }));
  }

  if (config.behaviors.bodyMutation.enabled) {
    enabledBehaviors.push(() => ({ type: 'bodyMutation' }));
  }

  if (config.behaviors.zombieMode.enabled && Math.random() < config.behaviors.zombieMode.probability) {
    enabledBehaviors.push(() => ({ type: 'zombieMode' }));
  }

  if (config.behaviors.headerHavoc.enabled) {
    enabledBehaviors.push(() => {
      const actions: Array<'delete' | 'scramble' | 'alter'> = ['delete', 'scramble', 'alter'];
      return {
        type: 'headerHavoc',
        action: randomChoice(actions),
        header: config.behaviors.headerHavoc.targetHeaders.length > 0
          ? randomChoice(config.behaviors.headerHavoc.targetHeaders)
          : undefined,
      };
    });
  }

  if (enabledBehaviors.length === 0) {
    return { type: 'none' };
  }

  const selected = randomChoice(enabledBehaviors);
  return selected();
}

/**
 * Check rate limiting and decide if a 429 should be returned.
 */
export function checkRateLimit(
  state: FuzzboxState,
  config: ReturnType<typeof mergeConfig>,
  clientId: string
): boolean {
  if (!config.behaviors.rateLimit.enabled) return false;

  const now = Date.now();
  const limit = config.behaviors.rateLimit.requestLimit;
  const windowMs = config.behaviors.rateLimit.windowMs;

  let clientData = state.rateLimitCounter.get(clientId);

  if (!clientData || now > clientData.resetAt) {
    clientData = { count: 0, resetAt: now + windowMs };
    state.rateLimitCounter.set(clientId, clientData);
  }

  clientData.count++;

  return clientData.count > limit;
}

/**
 * Colorized logger that writes to console.
 * Prefix with guitar emoji because chaos should be fun.
 */
export function createLogger(config: ReturnType<typeof mergeConfig>) {
  return {
    info: (message: string) => {
      if (config.silent) return;
      if (config.logger) {
        config.logger(message, 'info');
      } else {
        console.log(`${colors.cyan}🎸 [Fuzzbox]${colors.reset} ${message}`);
      }
    },
    warn: (message: string) => {
      if (config.silent) return;
      if (config.logger) {
        config.logger(message, 'warn');
      } else {
        console.log(`${colors.yellow}🎸 [Fuzzbox]${colors.reset} ${colors.yellow}${message}${colors.reset}`);
      }
    },
    error: (message: string) => {
      if (config.silent) return;
      if (config.logger) {
        config.logger(message, 'error');
      } else {
        console.log(`${colors.red}🎸 [Fuzzbox]${colors.reset} ${colors.red}${message}${colors.reset}`);
      }
    },
  };
}

/**
 * Random integer between min (inclusive) and max (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick a random item from an array.
 */
export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
