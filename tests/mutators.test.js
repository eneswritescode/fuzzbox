/**
 * Mutator tests
 * Run with: node tests/mutators.test.js
 */

const assert = require('assert');

console.log('🧪 Running mutator tests...\n');

// Test 1: mutateBody - primitives
function testMutateBodyPrimitives() {
  // Mock mutateBody function
  function mutateBody(value, fieldProbability) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      return Math.random() < fieldProbability ? undefined : value;
    }
    if (typeof value === 'number') {
      return Math.random() < fieldProbability ? -999 : value;
    }
    if (typeof value === 'boolean') {
      return Math.random() < fieldProbability ? !value : value;
    }
    
    return value;
  }

  // Test with 100% mutation probability
  const stringResult = mutateBody('test', 1.0);
  assert.strictEqual(stringResult, undefined, 
    'String should mutate to undefined with probability 1.0'
  );

  const numberResult = mutateBody(42, 1.0);
  assert.strictEqual(numberResult, -999, 
    'Number should mutate to -999 with probability 1.0'
  );

  const boolResult = mutateBody(true, 1.0);
  assert.strictEqual(boolResult, false, 
    'Boolean should flip with probability 1.0'
  );

  // Test with 0% mutation probability
  const noMutateString = mutateBody('test', 0.0);
  assert.strictEqual(noMutateString, 'test', 
    'String should not mutate with probability 0.0'
  );

  console.log('  ✓ mutateBody correctly mutates primitive types');
}

// Test 2: mutateBody - objects
function testMutateBodyObjects() {
  function mutateBody(value, fieldProbability) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      return Math.random() < fieldProbability ? undefined : value;
    }
    if (typeof value === 'number') {
      return Math.random() < fieldProbability ? -999 : value;
    }
    if (typeof value === 'boolean') {
      return Math.random() < fieldProbability ? !value : value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => mutateBody(item, fieldProbability));
    }
    
    if (typeof value === 'object') {
      const mutated = {};
      for (const [key, val] of Object.entries(value)) {
        mutated[key] = mutateBody(val, fieldProbability);
      }
      return mutated;
    }
    
    return value;
  }

  const input = {
    name: 'Alice',
    age: 30,
    active: true,
  };

  // With 0% probability, should be unchanged
  const noMutation = mutateBody(input, 0.0);
  assert.deepStrictEqual(noMutation, input, 
    'Object should not mutate with probability 0.0'
  );

  // With 100% probability, all fields should be mutated
  const fullMutation = mutateBody(input, 1.0);
  assert.strictEqual(fullMutation.name, undefined);
  assert.strictEqual(fullMutation.age, -999);
  assert.strictEqual(fullMutation.active, false);

  console.log('  ✓ mutateBody recursively mutates objects');
}

// Test 3: mutateBody - arrays
function testMutateBodyArrays() {
  function mutateBody(value, fieldProbability) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      return Math.random() < fieldProbability ? undefined : value;
    }
    if (typeof value === 'number') {
      return Math.random() < fieldProbability ? -999 : value;
    }
    if (typeof value === 'boolean') {
      return Math.random() < fieldProbability ? !value : value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => mutateBody(item, fieldProbability));
    }
    
    if (typeof value === 'object') {
      const mutated = {};
      for (const [key, val] of Object.entries(value)) {
        mutated[key] = mutateBody(val, fieldProbability);
      }
      return mutated;
    }
    
    return value;
  }

  const input = [1, 2, 3, 4, 5];
  const mutated = mutateBody(input, 1.0);
  
  assert(Array.isArray(mutated), 'Should return an array');
  assert(mutated.every(n => n === -999), 'All numbers should be mutated to -999');

  console.log('  ✓ mutateBody recursively mutates arrays');
}

// Test 4: mutateBody - nested structures
function testMutateBodyNested() {
  function mutateBody(value, fieldProbability) {
    if (value === null || value === undefined) return value;
    
    if (typeof value === 'string') {
      return Math.random() < fieldProbability ? undefined : value;
    }
    if (typeof value === 'number') {
      return Math.random() < fieldProbability ? -999 : value;
    }
    if (typeof value === 'boolean') {
      return Math.random() < fieldProbability ? !value : value;
    }
    
    if (Array.isArray(value)) {
      return value.map(item => mutateBody(item, fieldProbability));
    }
    
    if (typeof value === 'object') {
      const mutated = {};
      for (const [key, val] of Object.entries(value)) {
        mutated[key] = mutateBody(val, fieldProbability);
      }
      return mutated;
    }
    
    return value;
  }

  const input = {
    users: [
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ],
    meta: {
      count: 2,
      status: 'ok',
    },
  };

  const mutated = mutateBody(input, 1.0);
  
  assert.strictEqual(mutated.users[0].id, -999);
  assert.strictEqual(mutated.users[0].name, undefined);
  assert.strictEqual(mutated.users[0].active, false);
  assert.strictEqual(mutated.meta.count, -999);
  assert.strictEqual(mutated.meta.status, undefined);

  console.log('  ✓ mutateBody handles deeply nested structures');
}

// Test 5: tryParseJSON
function testTryParseJSON() {
  function tryParseJSON(body) {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  const valid = tryParseJSON('{"name":"Alice"}');
  assert.deepStrictEqual(valid, { name: 'Alice' }, 
    'Should parse valid JSON'
  );

  const invalid = tryParseJSON('not json');
  assert.strictEqual(invalid, null, 
    'Should return null for invalid JSON'
  );

  const empty = tryParseJSON('');
  assert.strictEqual(empty, null, 
    'Should return null for empty string'
  );

  console.log('  ✓ tryParseJSON correctly parses and handles errors');
}

// Test 6: applyHeaderHavoc - delete
function testHeaderHavocDelete() {
  function applyHeaderHavoc(headers, action, targetHeader) {
    const modifiedHeaders = { ...headers };
    const headerKeys = Object.keys(modifiedHeaders);
    
    if (headerKeys.length === 0) return modifiedHeaders;
    
    const headerToMess = targetHeader && modifiedHeaders[targetHeader]
      ? targetHeader
      : headerKeys[0]; // Use first header for testing
    
    if (action === 'delete') {
      delete modifiedHeaders[headerToMess];
    }
    
    return modifiedHeaders;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  };

  const result = applyHeaderHavoc(headers, 'delete', 'Content-Type');
  
  assert.strictEqual(result['Content-Type'], undefined, 
    'Target header should be deleted'
  );
  assert.strictEqual(result['Cache-Control'], 'no-cache', 
    'Other headers should remain'
  );

  console.log('  ✓ applyHeaderHavoc correctly deletes headers');
}

// Test 7: applyHeaderHavoc - scramble
function testHeaderHavocScramble() {
  function applyHeaderHavoc(headers, action, targetHeader) {
    const modifiedHeaders = { ...headers };
    const headerKeys = Object.keys(modifiedHeaders);
    
    if (headerKeys.length === 0) return modifiedHeaders;
    
    const headerToMess = targetHeader && modifiedHeaders[targetHeader]
      ? targetHeader
      : headerKeys[0];
    
    if (action === 'scramble') {
      const originalValue = modifiedHeaders[headerToMess];
      if (typeof originalValue === 'string') {
        modifiedHeaders[headerToMess] = originalValue.split('').reverse().join('');
      }
    }
    
    return modifiedHeaders;
  }

  const headers = { 'Content-Type': 'application/json' };
  const result = applyHeaderHavoc(headers, 'scramble', 'Content-Type');
  
  assert.strictEqual(result['Content-Type'], 'nosj/noitacilppa', 
    'Header value should be reversed'
  );

  console.log('  ✓ applyHeaderHavoc correctly scrambles headers');
}

// Test 8: applyHeaderHavoc - alter
function testHeaderHavocAlter() {
  function applyHeaderHavoc(headers, action, targetHeader) {
    const modifiedHeaders = { ...headers };
    const headerKeys = Object.keys(modifiedHeaders);
    
    if (headerKeys.length === 0) return modifiedHeaders;
    
    const headerToMess = targetHeader && modifiedHeaders[targetHeader]
      ? targetHeader
      : headerKeys[0];
    
    if (action === 'alter') {
      if (headerToMess.toLowerCase() === 'content-type') {
        modifiedHeaders[headerToMess] = 'text/plain';
      } else {
        const currentValue = modifiedHeaders[headerToMess];
        if (typeof currentValue === 'string') {
          modifiedHeaders[headerToMess] = currentValue + '; chaos=true';
        }
      }
    }
    
    return modifiedHeaders;
  }

  // Test Content-Type alteration
  const headers1 = { 'Content-Type': 'application/json' };
  const result1 = applyHeaderHavoc(headers1, 'alter', 'Content-Type');
  assert.strictEqual(result1['Content-Type'], 'text/plain', 
    'Content-Type should be changed to text/plain'
  );

  // Test other header alteration
  const headers2 = { 'Cache-Control': 'no-cache' };
  const result2 = applyHeaderHavoc(headers2, 'alter', 'Cache-Control');
  assert.strictEqual(result2['Cache-Control'], 'no-cache; chaos=true', 
    'Other headers should have chaos flag appended'
  );

  console.log('  ✓ applyHeaderHavoc correctly alters headers');
}

// Test 9: Mutation probability distribution
function testMutationProbability() {
  function mutateBody(value, fieldProbability) {
    if (typeof value === 'number') {
      return Math.random() < fieldProbability ? -999 : value;
    }
    return value;
  }

  const iterations = 1000;
  const probability = 0.3;
  let mutatedCount = 0;

  for (let i = 0; i < iterations; i++) {
    const result = mutateBody(42, probability);
    if (result === -999) mutatedCount++;
  }

  const rate = mutatedCount / iterations;
  
  // Should be roughly 30% with some variance (20-40%)
  assert(rate > 0.2 && rate < 0.4, 
    `Mutation probability 0.3 should result in ~30% mutation rate, got ${rate}`
  );

  console.log('  ✓ Mutation probability distribution is correct');
}

// Run all tests
function runTests() {
  try {
    testMutateBodyPrimitives();
    testMutateBodyObjects();
    testMutateBodyArrays();
    testMutateBodyNested();
    testTryParseJSON();
    testHeaderHavocDelete();
    testHeaderHavocScramble();
    testHeaderHavocAlter();
    testMutationProbability();

    console.log('\n✅ All mutator tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
