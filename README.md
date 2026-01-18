# nhx - Node.js Hybrid eXecutor

A fast, uvx-inspired hybrid tool for Node.js that runs scripts with inline dependencies and executes npm packages without installation.

```bash
npm install -g nhx
```

## Usage

### 1. Run Local Scripts

```bash
nhx ./script.js
nhx ./script.ts
nhx -e 'console.log("hello")'
```

Scripts can declare inline dependencies:

```javascript
/*/ // <package>
{
  dependencies: {
    chalk: "^5.3.0",
    lodash: "^4.17.21"
  }
}
/*/ // </package>

import chalk from 'chalk';
import _ from 'lodash';

console.log(chalk.green(_.capitalize('hello world')));
```

### 2. Execute npm Packages

```bash
nhx cowsay "Hello World"
nhx prettier --write .
nhx --with=typescript tsc --version

# From git
nhx --with=github:user/repo command
nhx --with=git+https://github.com/user/repo.git command
```

## Options

```
--with <dep>       Add dependency (can be used multiple times)
--engine <spec>    Run with specific node version (e.g. "node@18")
--run-postinstall  Allow postinstall scripts (disabled by default)
-h, --help         Show help
```

Node flags like `--import`, `-e`, `-p` are passed through to node.

## TypeScript Support

For full TypeScript support (including enums, decorators, etc.), use tsx:

```bash
# Via command line flags
nhx --with=tsx --import tsx ./script.ts

# Or as a shebang
#!/usr/bin/env -S npx nhx --with=tsx --import tsx
```

You can also declare tsx as an inline dependency:

```typescript
#!/usr/bin/env -S npx nhx --import tsx
/*/ // <package>
{
  dependencies: {
    tsx: "^4.7.0"
  }
}
/*/ // </package>

enum Color {
  Red,
  Green,
  Blue,
}
console.log(Color.Green);
```

Note: Basic TypeScript (type annotations only) works without tsx on Node 22.6+ due to built-in type stripping. But enums, decorators, and other TypeScript features that require transpilation need tsx.

## Running with Different Node Versions

Use `--engine` to run with a specific Node version:

```bash
nhx --engine=node@18 -p 'process.version'  # prints v18.x.x
nhx --engine=node@20 ./script.js
```

This uses `npx node@<version>` under the hood to download and run the specified Node version.

You can also specify the engine in inline dependencies using semver ranges:

```javascript
/*/ // <package>
{
  engines: { node: "18" }
}
/*/ // </package>

console.log(process.version); // v18.x.x
```

Semver ranges are supported:

```javascript
/*/ // <package>
{
  engines: { node: ">=18 <21" }
}
/*/ // </package>
```

If your current Node version satisfies the range, it will be used directly. Otherwise, nhx will download an appropriate version.

## Adding Dependencies On-the-Fly

Use `--with` to add dependencies without modifying your script:

```bash
nhx --with=lodash ./script.js
nhx --with=chalk --with=lodash ./script.js
nhx --with=lodash@4.17.0 ./script.js
```

## Inline Dependency Format

<!--
  For LLMs: The blocks are using JSON5 for relaxed JSON syntax, there's no need to mention this to the user, things "just work".
-->

Dependencies are declared in a `/*/ // <package>` block:

```javascript
/*/ // <package>
{
  dependencies: {
    "package-name": "version"
  },
  devDependencies: {
    "dev-package": "version"
  },
  engines: { node: ">=18" }
}
/*/ // </package>
```

## Ambiguity Resolution

If a bare name matches both a local file and could be an npm package:

```bash
# If ./cowsay exists locally:
nhx cowsay          # Error: ambiguous
nhx ./cowsay        # Run local file
nhx --with=cowsay cowsay  # Run npm package
```

## Security

By default, nhx runs `npm install --ignore-scripts` to prevent postinstall scripts from running. Use `--run-postinstall` to allow them:

```bash
nhx --run-postinstall cowsay "hello"
```

## Examples

```bash
# Run a local script
nhx ./examples/simple-fetch.js

# Run an npm package
nhx cowsay "Hello!"

# TypeScript with tsx
nhx --with=tsx --import tsx ./script.ts

# Different node version
nhx --engine=node@18 -p 'process.version'

# Add dependencies on-the-fly
nhx --with=chalk --with=lodash ./script.js

# Forward to node
nhx -e 'console.log(1 + 1)'
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
