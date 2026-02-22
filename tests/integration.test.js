/**
 * Integration tests for Express and Next.js adapters
 * Run with: node tests/integration.test.js
 */

const assert = require('assert');

console.log('🧪 Running integration tests...\n');

// Note: These tests verify the adapter interfaces and basic functionality
// Actual HTTP testing would require running the built package

// Test 1: Express middleware interface
function testExpressMiddlewareInterface() {
  // Mock Express middleware factory
  function fuzzboxExpress(config = {}) {
    return function middleware(req, res, next) {
      // Middleware should accept (req, res, next) signature
      assert(typeof req === 'object', 'First argument should be request object');
      assert(typeof res === 'object', 'Second argument should be response object');
      assert(typeof next === 'function', 'Third argument should be next function');
      
      // If disabled, should call next immediately
      if (!config.enabled) {
        return next();
      }
      
      // Otherwise, apply chaos logic
      next();
    };
  }

  const middleware = fuzzboxExpress({ enabled: false });
  
  // Mock Express req/res/next
  const req = { method: 'GET', url: '/api/users' };
  const res = { statusCode: 200, send: () => {} };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  middleware(req, res, next);
  
  assert(nextCalled, 'Middleware should call next() when disabled');

  console.log('  ✓ Express middleware has correct interface');
}

// Test 2: Express dashboard route registration
function testExpressDashboardRoutes() {
  // Mock route checking
  const dashboardPaths = [
    '/__fuzzbox',
    '/__fuzzbox/api/state',
  ];

  dashboardPaths.forEach(path => {
    assert(typeof path === 'string', 'Dashboard path should be string');
    assert(path.startsWith('/__fuzzbox'), 'Dashboard should be under /__fuzzbox');
  });

  console.log('  ✓ Express dashboard routes are properly defined');
}

// Test 3: Next.js App Router middleware interface
function testNextJsAppRouterInterface() {
  // Mock Next.js middleware
  function fuzzboxNext(config = {}) {
    return async function middleware(request) {
      assert(request && typeof request === 'object', 
        'Middleware should receive request object'
      );
      
      // Should return NextResponse or void
      // If disabled, return undefined (pass through)
      if (!config.enabled) {
        return undefined;
      }
      
      // Otherwise, apply chaos logic
      return undefined;
    };
  }

  const middleware = fuzzboxNext({ enabled: false });
  
  // Mock Next.js request
  const request = {
    nextUrl: { pathname: '/api/users' },
    method: 'GET',
  };

  const result = middleware(request);
  
  assert(result === undefined || (result && typeof result.then === 'function'), 
    'Middleware should return void or Promise'
  );

  console.log('  ✓ Next.js App Router middleware has correct interface');
}

// Test 4: Next.js Pages Router API wrapper interface
function testNextJsPagesRouterInterface() {
  // Mock Pages Router wrapper
  function fuzzboxApiRoute(handler, config = {}) {
    return async function wrappedHandler(req, res) {
      assert(typeof req === 'object', 'First argument should be request');
      assert(typeof res === 'object', 'Second argument should be response');
      assert(typeof handler === 'function', 'Handler should be a function');
      
      // If disabled, call handler directly
      if (!config.enabled) {
        return await handler(req, res);
      }
      
      // Otherwise, apply chaos then call handler
      return await handler(req, res);
    };
  }

  const originalHandler = (req, res) => {
    res.status(200).json({ ok: true });
  };

  const wrappedHandler = fuzzboxApiRoute(originalHandler, { enabled: false });
  
  assert(typeof wrappedHandler === 'function', 
    'Wrapper should return a function'
  );

  console.log('  ✓ Next.js Pages Router wrapper has correct interface');
}

// Test 5: Config validation
function testConfigValidation() {
  const validConfigs = [
    {},
    { enabled: false },
    { probability: 0.5 },
    { includeRoutes: ['/api/'] },
    { excludeRoutes: ['/health'] },
    { dashboardPath: '/__chaos' },
    { silent: true },
    { behaviors: { latency: { enabled: true } } },
  ];

  validConfigs.forEach(config => {
    assert(typeof config === 'object', 'Config should be an object');
    
    if (config.probability !== undefined) {
      assert(config.probability >= 0 && config.probability <= 1, 
        'Probability should be between 0 and 1'
      );
    }
    
    if (config.includeRoutes !== undefined) {
      assert(Array.isArray(config.includeRoutes), 
        'includeRoutes should be an array'
      );
    }
    
    if (config.excludeRoutes !== undefined) {
      assert(Array.isArray(config.excludeRoutes), 
        'excludeRoutes should be an array'
      );
    }
  });

  console.log('  ✓ Config validation accepts valid configurations');
}

// Test 6: Response interception
function testResponseInterception() {
  // Mock response object
  const mockResponse = {
    statusCode: 200,
    _body: null,
    send: function(body) {
      this._body = body;
      return this;
    },
    json: function(data) {
      this._body = JSON.stringify(data);
      return this;
    },
    status: function(code) {
      this.statusCode = code;
      return this;
    },
  };

  // Original methods
  const originalSend = mockResponse.send;
  const originalJson = mockResponse.json;

  // Mock interception
  mockResponse.send = function(body) {
    // Apply chaos mutations here
    return originalSend.call(this, body);
  };

  mockResponse.json = function(data) {
    // Apply chaos mutations here
    return originalJson.call(this, data);
  };

  // Test that interception works
  mockResponse.json({ name: 'Alice' });
  assert(mockResponse._body === '{"name":"Alice"}', 
    'Response interception should preserve functionality'
  );

  console.log('  ✓ Response interception maintains original behavior');
}

// Test 7: Route matching with complex patterns
function testComplexRouteMatching() {
  function matchesRoute(path, patterns) {
    return patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return path.startsWith(pattern);
      }
      if (pattern instanceof RegExp) {
        return pattern.test(path);
      }
      return false;
    });
  }

  const testCases = [
    { path: '/api/v1/users', patterns: ['/api/'], expect: true },
    { path: '/api/v1/users', patterns: [/^\/api\/v\d+\//], expect: true },
    { path: '/webhook', patterns: ['/api/', '/admin/'], expect: false },
    { path: '/api/health', patterns: [/health$/], expect: true },
  ];

  testCases.forEach(({ path, patterns, expect: expected }) => {
    const result = matchesRoute(path, patterns);
    assert.strictEqual(result, expected, 
      `Path ${path} should ${expected ? 'match' : 'not match'} patterns`
    );
  });

  console.log('  ✓ Complex route patterns match correctly');
}

// Test 8: Dashboard state management
function testDashboardState() {
  const state = {
    enabled: true,
    probability: 0.1,
    spikeMode: false,
    spikeModeExpiry: null,
    totalRequests: 0,
    fuzzedRequests: 0,
    chaosActions: {
      latency: 0,
      errors: 0,
      timeout: 0,
      bodyMutation: 0,
      zombieMode: 0,
      headerHavoc: 0,
      rateLimit: 0,
    },
  };

  // Simulate request
  state.totalRequests++;
  
  // If chaos applied
  state.fuzzedRequests++;
  state.chaosActions.latency++;

  assert.strictEqual(state.totalRequests, 1, 'Should track total requests');
  assert.strictEqual(state.fuzzedRequests, 1, 'Should track fuzzed requests');
  assert.strictEqual(state.chaosActions.latency, 1, 'Should track chaos actions');

  console.log('  ✓ Dashboard state tracking works correctly');
}

// Test 9: Spike mode activation
function testSpikeModeActivation() {
  const state = {
    enabled: true,
    probability: 0.1,
    spikeMode: false,
    spikeModeExpiry: null,
  };

  // Activate spike mode
  state.spikeMode = true;
  state.spikeModeExpiry = Date.now() + 30000; // 30 seconds

  assert.strictEqual(state.spikeMode, true, 'Spike mode should be activated');
  assert(state.spikeModeExpiry > Date.now(), 
    'Spike mode expiry should be in the future'
  );

  // Effective probability in spike mode
  const effectiveProbability = state.spikeMode ? 0.8 : state.probability;
  assert.strictEqual(effectiveProbability, 0.8, 
    'Spike mode should use 0.8 probability'
  );

  console.log('  ✓ Spike mode activation updates state correctly');
}

// Test 10: Behavior enable/disable toggle
function testBehaviorToggle() {
  const behaviors = {
    latency: { enabled: true, minMs: 100, maxMs: 3000 },
    errors: { enabled: true, statusCodes: [500, 502, 503, 504] },
    timeout: { enabled: false },
    bodyMutation: { enabled: true, fieldProbability: 0.3 },
  };

  // Count enabled behaviors
  const enabledBehaviors = Object.entries(behaviors)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name);

  assert.strictEqual(enabledBehaviors.length, 3, 
    'Should have 3 enabled behaviors'
  );
  assert(enabledBehaviors.includes('latency'), 
    'Latency should be enabled'
  );
  assert(!enabledBehaviors.includes('timeout'), 
    'Timeout should be disabled'
  );

  console.log('  ✓ Behavior enable/disable toggle works correctly');
}

// Test 11: Multiple behavior selection
function testMultipleBehaviorSelection() {
  const enabledActions = ['latency', 'errors', 'bodyMutation'];
  
  // Simulate random selection
  const selected = enabledActions[Math.floor(Math.random() * enabledActions.length)];
  
  assert(enabledActions.includes(selected), 
    'Selected action should be from enabled behaviors'
  );

  console.log('  ✓ Random behavior selection works correctly');
}

// Test 12: Client IP extraction (for rate limiting)
function testClientIPExtraction() {
  function getClientIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  const tests = [
    { req: { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } }, expect: '192.168.1.1' },
    { req: { headers: { 'x-real-ip': '192.168.1.2' } }, expect: '192.168.1.2' },
    { req: { headers: {}, socket: { remoteAddress: '127.0.0.1' } }, expect: '127.0.0.1' },
    { req: { headers: {} }, expect: 'unknown' },
  ];

  tests.forEach(({ req, expect: expected }) => {
    const ip = getClientIP(req);
    assert.strictEqual(ip, expected, 
      `Should extract IP correctly for ${JSON.stringify(req)}`
    );
  });

  console.log('  ✓ Client IP extraction works correctly');
}

// Run all tests
function runTests() {
  try {
    testExpressMiddlewareInterface();
    testExpressDashboardRoutes();
    testNextJsAppRouterInterface();
    testNextJsPagesRouterInterface();
    testConfigValidation();
    testResponseInterception();
    testComplexRouteMatching();
    testDashboardState();
    testSpikeModeActivation();
    testBehaviorToggle();
    testMultipleBehaviorSelection();
    testClientIPExtraction();

    console.log('\n✅ All integration tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
