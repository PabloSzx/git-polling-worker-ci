# Git Polling Worker CI

[![npm version](https://badge.fury.io/js/git-polling-worker-ci.svg)](https://badge.fury.io/js/git-polling-worker-ci)

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

#### Directory changed scripts

> (Only via script)

You can specify `Directory changed scripts`, to verify if specific directories change, and only if the did, execute the specified script, which can be a string of the bash script to be executed or the function (can be an async function).

These scripts always execute before the main command, either sequentially or in parallel (`sequentially` by default).

```js
workerGitCI({
  command: "yarn start", // You can specify a shell script.
  script: () => {
    // Or a function, but at least one of them has to be specified.
    console.log("Hello world");
  },
  pollingInterval: "30 seconds", // optional => default = 1 minute
  continueAfterExecution: false, // optional => default = true
  directoryChangedScripts: {
    parallel: true, // optional =>  default = false
    options: [
      {
        script: "yarn build-client", // Can be a function or a shell script.
        directory: "client", // Directory to compare with, using https://www.npmjs.com/package/folder-hash
      },
      {
        script: "yarn build-api",
        directory: "api",
      },
    ],
  },
});
```
