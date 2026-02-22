# Fuzzbox Test Suite

Simple, zero-dependency tests using Node.js built-in `assert` module.

## Running Tests

Run all tests:
\`\`\`bash
npm test
\`\`\`

Run individual test files:
\`\`\`bash
node tests/core.test.js        # Core logic tests
node tests/mutators.test.js    # Mutator tests
node tests/integration.test.js # Integration tests
\`\`\`

## Test Files

### core.test.js
Tests core functions:
- `mergeConfig()` - Configuration deep merging
- `shouldFuzzRoute()` - Route pattern matching (string and RegExp)
- `shouldInjectChaos()` - Probability calculations
- Spike mode activation and expiry
- Random action selection
- Rate limit tracking

### mutators.test.js
Tests mutation logic:
- `mutateBody()` - Primitive type mutations (string→undefined, number→-999, boolean→flip)
- Recursive object/array mutation
- Header havoc (delete, scramble, alter)
- JSON parsing and mutation probability distribution

### integration.test.js
Tests adapter interfaces and behavior:
- Express middleware interface and dashboard routes
- Next.js App Router middleware interface
- Next.js Pages Router API wrapper
- Configuration validation
- Response interception
- Route matching edge cases
- Dashboard state management
- Client IP extraction (for rate limiting)

## Philosophy

Tests are intentionally simple and direct. They verify:
1. **Interfaces**: Correct function signatures and return types
2. **Logic**: Core algorithms work as expected
3. **Edge cases**: Boundary conditions and error handling

No unnecessary test frameworks. Just Node.js built-ins and clean assertions.

## Adding Tests

When adding new features:
1. Add unit tests for isolated functions in `core.test.js` or `mutators.test.js`
2. Add integration tests for adapter behavior in `integration.test.js`
3. Keep tests simple—one assertion per test function when possible
4. Use descriptive test names that explain what's being tested

## Notes

- Tests don't require building the TypeScript source
- Some tests verify interfaces without importing actual compiled code (to avoid circular dependencies)
- Probability-based tests run multiple iterations to verify statistical behavior
- All tests use synchronous assertions for simplicity
