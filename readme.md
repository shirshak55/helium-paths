# Helium Paths

[![npm version](https://img.shields.io/npm/v/helium-paths.svg)](https://www.npmjs.com/package/helium-paths)
[![Downloads](https://img.shields.io/npm/dm/helium-paths.svg)](https://npmjs.com/helium-paths)
[![Install size](https://packagephobia.now.sh/badge?p=helium-paths)](https://packagephobia.now.sh/result?p=helium-paths)
![tests](https://github.com/shirshak55/helium-paths/actions/workflows/tests.yaml/badge.svg)

Possible paths or binary names of [Helium](https://helium.computer) in the current platform

### Why?

-   Well Documented
-   Well Tested
-   Zero dependencies
-   Written with Love <3
-   Fully open sourced

### Usage

-   Helium ships a single channel. There is no separate beta / dev / canary build
    like Edge, so there are just two functions. On Linux the `.desktop` entry is
    parsed as well, so AppImage installs are found too.

###### Javascript

```javascript
import { getHeliumPath, getAnyHelium } from "./dist/index.js"

console.log(getHeliumPath())
// console.log(getAnyHelium())
```

The output shall look like this according to your installation

```javascript
// On macOS
// /Applications/Helium.app/Contents/MacOS/Helium

// On Windows
// C:\Users\you\AppData\Local\imput\Helium\Application\chrome.exe

// On Linux
// /usr/bin/helium
```

###### Typescript

```typescript
import { getHeliumPath, getAnyHelium } from "helium-paths"

console.log(getHeliumPath())
console.log(getAnyHelium())
```

## Installation

[Use](https://docs.npmjs.com/cli/install) [npm](https://docs.npmjs.com/about-npm/).

```bash
$ npm install helium-paths

// or

$ yarn add helium-paths
```

## API

```javascript
import { getHeliumPath, getAnyHelium } from "helium-paths"
```

-   `getHeliumPath()` returns the Helium binary path, or throws if it can't be found.
-   `getAnyHelium()` is the same today, but use it if you don't want to care about specific channels later.

Both throw a plain `{ name: "helium-paths", message, ... }` object when Helium isn't found, so wrap them in a try/catch if that is expected.

## License

[MIT License](./LICENSE)

© 2026 Shirshak Bajgain
