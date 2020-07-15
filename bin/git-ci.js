#!/usr/bin/env node

const { program } = require("commander");
const ms = require("ms");
const { workerGitCI } = require("../dist/index");

program
  .version("0.0.1")
  .description("Minimal Git CI Polling solution.")
  .option("-d, --directory <dir>", "Specify a directory different than the current one.")
  .option(
    "-i, --interval <n>",
    'Specify polling interval. It should follow https://www.npmjs.com/package/ms API, for example: git-ci -i "60 seconds".'
  )
  .option("--no-continue", "If the polling should stop after a successful execution.")
  .parse(process.argv);

workerGitCI({
  baseDir: program.directory,
  command: program.args.join(" "),
  pollingInterval: typeof program.interval === "string" ? ms(program.interval) : undefined,
  continueAfterExecution: program.continue,
});
