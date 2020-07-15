# Git Polling Worker CI

## Installation

### Global

```sh
yarn global add git-polling-worker-ci
# or
npm install -g git-polling-worker-ci
```

### Local

```sh
yarn add git-polling-worker-ci
# or
npm install git-polling-worker-ci
```

## Usage

### Global

```
Usage: git-ci [options]

Minimal Git CI Polling solution.

Options:
  -V, --version          output the version number
  -d, --directory <dir>  Specify a directory different than the current one.
  -i, --interval <n>     Specify polling interval. It should follow https://www.npmjs.com/package/ms API,
  for example: git-ci -i "60 seconds".
  --no-continue          If the polling should stop after a successful execution.
  -h, --help             display help for command
```

It will poll every 60 seconds, and if there is a new change detected in the remote repository, it will update the repo and call `yarn start`

```sh
git-ci yarn start
```

### Local

```js
// worker.js | worker.ts

// import { workerGitCI } from "git-polling-worker-ci";
const { workerGitCI } = require("git-polling-worker-ci");

workerGitCI({
  baseDir: "./",
  command: "yarn start",
  pollingInterval: "30 seconds",
  continueAfterExecution: true,
});
```
