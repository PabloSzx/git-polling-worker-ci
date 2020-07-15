import { exec } from "shelljs";
import ms from "ms";
import { resolve } from "path";
import simpleGit, { CheckRepoActions, ResetMode } from "simple-git";

export function workerGitCI(args: {
  baseDir?: string;
  /**
   * Command to be executed.
   */
  command: string;
  /**
   * Polling Interval to be used in milliseconds, by default is 60 seconds.
   * You can also set a string following https://www.npmjs.com/package/ms API
   */
  pollingInterval?: number | string;
  /**
   * If the polling should try to continue after an execution.
   *
   * By default is `true`
   */
  continueAfterExecution?: boolean;
}) {
  let { baseDir, command, pollingInterval = ms("60 seconds"), continueAfterExecution } = args;

  if (typeof baseDir === "string") {
    baseDir = resolve(baseDir);
  } else {
    baseDir = process.cwd();
  }

  if (!command) {
    const error = Error("Command invalid!");
    Error.captureStackTrace(error, workerGitCI);
    throw error;
  }

  const pollInterval = typeof pollingInterval === "string" ? ms(pollingInterval) : pollingInterval;

  const git = simpleGit({
    baseDir,
    maxConcurrentProcesses: 1,
  });

  async function isItBehind() {
    return Boolean((await git.status()).behind);
  }

  git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT).then((isRepo) => {
    if (isRepo) {
      git.status().then(async (result) => {
        const tracking = result.tracking;
        const current = result.current;
        console.log(
          `Worker Git CI Tracking: ${tracking} | ${current}, every ${ms(pollInterval, {
            long: true,
          })}.`
        );
        if (!tracking || !current) {
          console.error("Error: Not following a remote repository.");
          process.exit(1);
        }

        const polling = setInterval(async () => {
          await git.remote(["update"]).catch(console.error);

          if (await isItBehind()) {
            console.log("Reseting GIT Repo to: " + tracking);

            clearInterval(polling);

            await git.reset(ResetMode.HARD, [tracking]);
            await git.checkout(current);

            const cp = exec(command, { async: true });

            cp.on("close", (code) => {
              if (code === 0 && continueAfterExecution) {
                workerGitCI(args);
              } else {
                process.exit(0);
              }
            });
          }
        }, pollInterval);

        process.on("beforeExit", () => {
          git.clearQueue();
          clearInterval(polling);
        });
      });
    } else {
      console.error(`Error: ${baseDir} is not a valid git repository!`);
      process.exit(1);
    }
  });
}
