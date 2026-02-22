# Contributing to Fuzzbox

Thanks for considering contributing. Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/fuzzbox.git
cd fuzzbox

# Install dependencies
npm install

# Build the package
npm run build

# Watch mode for development
npm run dev
```

## Project Structure

```
fuzzbox/
├── src/
│   ├── adapters/       # Express & Next.js middleware
│   ├── mutators/       # Chaos injection utilities
│   ├── dashboard/      # Live control panel template
│   ├── core.ts         # Central chaos logic
│   ├── types.ts        # TypeScript definitions
│   └── index.ts        # Main export
├── dist/               # Compiled output (generated)
└── package.json
```

## Guidelines

- **Zero dependencies**: Only use Node.js built-ins. No external runtime dependencies.
- **TypeScript strict mode**: All code must pass strict type checking.
- **Keep it small**: This is a micro-library. Avoid feature bloat.
- **Test manually**: Run against real Express/Next.js apps to verify behavior.

## Adding New Chaos Behaviors

1. Add configuration interface to `src/types.ts`
2. Update `defaultConfig` in `src/core.ts`
3. Implement the behavior in the appropriate adapter
4. Document it in the README

## Code Style

- Use descriptive variable names
- Add comments for non-obvious logic
- Avoid generic AI corporate speak in docs
- Keep the tone direct and pragmatic

## Publishing

Only maintainers publish. Process:

```bash
npm version patch|minor|major
npm run build
npm publish
git push --tags
```
