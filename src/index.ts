/**
 * Fuzzbox - Chaos engineering and API fuzzing middleware
 * 
 * Break things intentionally before your users break them accidentally.
 * Zero dependencies. Zero mercy.
 */

export { fuzzboxExpress } from './adapters/express';
export { fuzzboxNext, fuzzboxApiRoute } from './adapters/next';

export type {
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
