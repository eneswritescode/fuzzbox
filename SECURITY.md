# Security Policy

## ⚠️ Critical Warning

**DO NOT USE FUZZBOX IN PRODUCTION.** 

This is a chaos engineering tool designed to intentionally break your API. If you deploy this to production with chaos enabled, you will:
- Corrupt user data in responses
- Drop legitimate requests
- Cause client-side errors
- Simulate outages
- Generally ruin your users' day

## Intended Use Cases

### ✅ Safe Environments
- **Local development**: Testing your frontend's error handling
- **Staging environments**: Load testing and resilience validation
- **CI/CD pipelines**: Automated chaos testing
- **Internal testing**: QA and integration testing

### ❌ Never Use In
- Production APIs serving real users
- Any environment where data integrity matters
- Payment processing systems
- Healthcare or financial applications
- Anywhere failure isn't acceptable

## Security Considerations

### 1. Dashboard Access Control

The dashboard at `/__fuzzbox` is **completely open by default**. Anyone who can reach your server can:
- Enable/disable chaos
- Trigger spike mode (80% failure rate)
- Reset statistics
- Adjust chaos probability

**Mitigation:**
```typescript
// Disable the dashboard in shared environments
app.use(fuzzboxExpress({
  dashboardPath: null, // Disables the dashboard
}));

// Or protect it with authentication
app.use('/__fuzzbox', (req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.FUZZBOX_KEY) {
    return res.status(401).send('Unauthorized');
  }
  next();
});
```

### 2. Rate Limit Bypass

Fuzzbox's rate limiting is **fake**. It doesn't actually protect your server. It only simulates rate limit responses for testing purposes. Real attackers won't be slowed down.

### 3. Information Disclosure

Chaos logs are written to stdout using colorized ANSI codes. These logs include:
- Request paths
- HTTP methods
- Chaos actions taken
- Client IP addresses (in rate limiting)

**Mitigation:**
```typescript
// Disable logging
app.use(fuzzboxExpress({
  silent: true,
}));

// Or use a custom logger that sanitizes data
app.use(fuzzboxExpress({
  logger: (msg, level) => {
    // Your secure logging implementation
  },
}));
```

### 4. Data Corruption

Body mutation **deliberately corrupts data** in JSON responses. If you accidentally enable this on a production endpoint:
- Numbers become `-999`
- Strings become `undefined`
- Booleans get flipped

This can cause:
- Client-side crashes
- Data integrity issues
- Security vulnerabilities if auth tokens/IDs are mutated

### 5. Denial of Service

Several chaos behaviors can cause legitimate DoS:

- **Timeout mode**: Holds connections indefinitely (memory leak)
- **Zombie mode**: Keeps connections open for minutes (exhausts file descriptors)
- **Latency injection**: Delays can queue up requests (threadpool exhaustion)

**Mitigation:**
Set reasonable limits and never enable on public endpoints:
```typescript
app.use(fuzzboxExpress({
  probability: 0.1, // Keep low
  excludeRoutes: ['/health', '/metrics', '/api/public/*'],
  behaviors: {
    timeout: { enabled: false }, // Disable dangerous modes
    zombieMode: { enabled: false },
  },
}));
```

## Dependency Security

Fuzzbox has **zero runtime dependencies**. This minimizes supply chain attack risks. However:

- Dev dependencies still exist (TypeScript, tsup, type definitions)
- Always run `npm audit` before installing
- Pin dependency versions in production builds

## Responsible Chaos Testing

### Before You Test

1. **Notify your team** - Don't surprise people with chaos
2. **Check monitoring** - Ensure you can observe the impact
3. **Have a kill switch** - Know how to disable it quickly
4. **Test off-hours** - Don't chaos test during peak traffic
5. **Start small** - Begin with 5-10% probability, not 50%

### During Testing

1. **Monitor real user impact** - Watch error rates in prod (if testing staging mirrors)
2. **Document findings** - Record which chaos exposed which bugs
3. **Fix issues** - The point is to find and fix problems, not just break things

### After Testing

1. **Disable Fuzzbox** - Remove or disable the middleware
2. **Share results** - Tell your team what you learned
3. **Improve resilience** - Implement proper error handling based on findings

## Reporting Security Issues

If you find a security vulnerability in Fuzzbox itself:

1. **DO NOT** open a public GitHub issue
2. Email: **eneswrites@protonmail.com**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

We'll acknowledge within 48 hours and work on a fix.

## Threat Model

Fuzzbox is designed to test **frontend resilience**, not to secure backends. The threat model assumes:

- The developer installing Fuzzbox is trusted
- The environment is not production
- Network access is restricted (internal testing only)
- Users understand this is a testing tool, not a security tool

If any of these assumptions are violated, don't use Fuzzbox.

## Legal Disclaimer

By using Fuzzbox, you acknowledge that:
- You will not deploy it to production
- You understand it intentionally breaks things
- Data corruption and outages are expected behavior
- The maintainers are not liable for any damage caused

Use at your own risk. Test responsibly.
