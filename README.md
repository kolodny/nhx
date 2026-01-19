# `nhx` - Node.js Hybrid eXecutor (a `uvx` inspired tool)

[![npm version](https://img.shields.io/npm/v/nhx.svg)](https://www.npmjs.com/package/nhx)
[![npm downloads](https://img.shields.io/npm/dm/nhx.svg)](https://www.npmjs.com/package/nhx)

A hybrid of `node ./script.js` and `npx package` - run scripts or packages with automatic dependency handling.

```bash
npm install -g nhx
```

## Why nhx?

- **Self-contained scripts** - Scripts declare their own dependencies and just work
- **No project setup** - No `package.json`, no `npm install`, no `node_modules`
- **Share scripts easily** - Send a single file that anyone can run
- **Fast** - Dependencies are cached globally, subsequent runs are instant
- **Works offline** - Once cached, no network needed

## Options

```
--with <dep>       Add a dependency (repeatable, supports @version)
--engine <spec>    Node version (e.g. node:18, node:>=16)
--run-postinstall  Allow postinstall scripts (disabled by default)
-h, --help         Show help
```

All other flags pass through to node.

## Examples

```bash
# Run an npm package
nhx cowsay hello

# Run a local script (dependencies installed automatically)
nhx ./script.js

# Add a dependency for a script
nhx --with=lodash ./script.js

# Pin a specific version
nhx --with=chalk@4.1.2 ./script.js

# Use a specific node version
nhx --engine=node:18 ./script.js

# Pipe from stdin
curl -s https://example.com/script.js | nhx -

# All node flags work
nhx -e 'console.log(1)'
nhx --check ./script.js
```

## Self-contained scripts

Scripts can declare their own dependencies inline:

```javascript
// hello.mjs
/*/ // <package>
{ dependencies: { chalk: "^5.0.0" } }
/*/ // </package>

import chalk from 'chalk';
console.log(chalk.green('Hello!'));
```

```bash
nhx ./hello.mjs
```

Dependencies are installed automatically on first run and cached for future runs.

### Specifying a node version

```javascript
/*/ // <package>
{ engines: { node: ">=18 <21" } }
/*/ // </package>

console.log(process.version);
```

If your current node satisfies the range, it's used directly. Otherwise nhx downloads an appropriate version.

### Loaders

Use tsx as a declared dependency **and** as a loader:

```typescript
#!/usr/bin/env -S nhx --with=tsx --import tsx
import { something } from './other.ts';
```

You can also do that with inline dependencies:

```typescript
#!/usr/bin/env -S nhx --import tsx
/*/ // <package>
{ devDependencies: { tsx: "^4" } }
/*/ // </package>
```

## License

MIT
