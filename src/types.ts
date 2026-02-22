/**
 * Configuration options for Fuzzbox chaos middleware.
 * Enable only what you need, or let it all burn.
 */
export interface FuzzboxConfig {
  /**
   * Probability (0-1) that any given request will be fuzzed.
   * 0.1 = 10% of requests get chaos injected.
   * @default 0.1
   */
  probability?: number;

  /**
   * Enable or disable Fuzzbox entirely without removing the middleware.
   * Useful for production toggles (if you're brave enough).
   * @default true
   */
  enabled?: boolean;

  /**
   * Route patterns to target. If specified, only matching routes get fuzzed.
   * Supports strings and RegExp. Empty array = fuzz everything.
   * @example ['/api/users', /^\/api\/payments/]
   */
  includeRoutes?: (string | RegExp)[];

  /**
   * Route patterns to exclude. Takes precedence over includeRoutes.
   * @example ['/health', '/api/internal']
   */
  excludeRoutes?: (string | RegExp)[];

  /**
   * Path to mount the live dashboard UI.
   * Set to null to disable the dashboard entirely.
   * @default '/__fuzzbox'
   */
  dashboardPath?: string | null;

  /**
   * Chaos behaviors to enable. If not specified, all are enabled.
   */
  behaviors?: {
    /**
     * Inject random latency into responses.
     */
    latency?: LatencyConfig;

    /**
     * Randomly throw HTTP error responses (500, 502, 503, 504).
     */
    errors?: ErrorConfig;

    /**
     * Hold the request forever without responding (timeout simulation).
     */
    timeout?: TimeoutConfig;

    /**
     * Mutate JSON response bodies to test client parsing resilience.
     */
    bodyMutation?: BodyMutationConfig;

    /**
     * Stream responses back painfully slowly (zombie drip).
     */
    zombieMode?: ZombieModeConfig;

    /**
     * Scramble, delete, or alter response headers.
     */
    headerHavoc?: HeaderHavocConfig;

    /**
     * Simulate rate limiting with 429 responses.
     */
    rateLimit?: RateLimitConfig;
  };

  /**
   * Custom logger function. If not provided, defaults to colorized console output.
   */
  logger?: (message: string, level: 'info' | 'warn' | 'error') => void;

  /**
   * Disable all console logging.
   * @default false
   */
  silent?: boolean;
}

export interface LatencyConfig {
  enabled?: boolean;
  /**
   * Minimum delay in milliseconds.
   * @default 100
   */
  minMs?: number;
  /**
   * Maximum delay in milliseconds.
   * @default 3000
   */
  maxMs?: number;
}

export interface ErrorConfig {
  enabled?: boolean;
  /**
   * HTTP status codes to randomly inject.
   * @default [500, 502, 503, 504]
   */
  statusCodes?: number[];
}

export interface TimeoutConfig {
  enabled?: boolean;
  /**
   * Probability (0-1) of triggering a timeout within the chaos probability.
   * @default 0.2
   */
  probability?: number;
}

export interface BodyMutationConfig {
  enabled?: boolean;
  /**
   * Only mutate responses with these status codes.
   * @default [200]
   */
  statusCodes?: number[];
  /**
   * Probability (0-1) of mutating a field within a JSON response.
   * @default 0.3
   */
  fieldProbability?: number;
}

export interface ZombieModeConfig {
  enabled?: boolean;
  /**
   * Bytes per second to drip out the response.
   * @default 10
   */
  bytesPerSecond?: number;
  /**
   * Probability (0-1) of zombie mode triggering within the chaos probability.
   * @default 0.1
   */
  probability?: number;
}

export interface HeaderHavocConfig {
  enabled?: boolean;
  /**
   * Headers to potentially scramble or delete.
   * If empty, random headers are chosen.
   * @default []
   */
  targetHeaders?: string[];
}

export interface RateLimitConfig {
  enabled?: boolean;
  /**
   * Number of requests before triggering a 429.
   * Resets every `windowMs`.
   * @default 10
   */
  requestLimit?: number;
  /**
   * Time window in milliseconds for rate limit tracking.
   * @default 60000 (1 minute)
   */
  windowMs?: number;
  /**
   * Retry-After header value in seconds.
   * @default 60
   */
  retryAfterSeconds?: number;
}

/**
 * Internal chaos action types
 */
export type ChaosAction =
  | { type: 'latency'; delayMs: number }
  | { type: 'error'; statusCode: number }
  | { type: 'timeout' }
  | { type: 'bodyMutation' }
  | { type: 'zombieMode' }
  | { type: 'headerHavoc'; action: 'delete' | 'scramble' | 'alter'; header?: string }
  | { type: 'rateLimit' }
  | { type: 'none' };

/**
 * Mutable runtime state for the dashboard to control
 */
export interface FuzzboxState {
  enabled: boolean;
  probability: number;
  spikeMode: boolean;
  spikeModeExpiry: number | null;
  requestCount: number;
  chaosCount: number;
  rateLimitCounter: Map<string, { count: number; resetAt: number }>;
}
