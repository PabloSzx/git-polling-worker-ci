import { exec } from "shelljs";
import ms from "ms";
import { resolve as pathResolve } from "path";
import simpleGit, { CheckRepoActions, ResetMode } from "simple-git";
import { hashElement } from "folder-hash";

const directoryHash = async (directory: string) => {
  return (await hashElement(directory)).toString();
};

export function workerGitCI(args: {
  /**
   * Base directory of the Git Repository.
   *
   * By default is the directory from where the script was executed.
   */
  baseDir?: string;
  /**
   * Command to be executed.
   */
  command?: string;
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
  /**
   * Specify a script to be executed instead of the command
   */
  script?: () => Promise<void> | void;
  /**
   * Reset repository, useful for debugging.
   *
   * By default is true
   */
  resetRepository?: boolean;
  /**
   * Directory changed based scripts.
   *
   * If the specified directories change after a git repository checkout
   * the specified scripts are executed.
   */
  directoryChangedScripts?: {
    /**
     * If the scripts should be executed in parallel, set this to `true`.
     */
    parallel?: boolean;
    /**
     * Scripts + directories arrays
     */
    options: {
      /**
       * Script to be executed, can be a shell script string or a function.
       */
      script: (() => Promise<void> | void) | string;
      /**
       * Directory to check against.
       */
      directory: string;
    }[];
  };
}) {
  let {
    baseDir,
    command,
    pollingInterval = ms("60 seconds"),
    continueAfterExecution = true,
    script,
    resetRepository = true,
    directoryChangedScripts,
  } = args;

  if (!command && !script) {
    console.error(`Error: You have to specify command or script!`);
    process.exit(1);
  }

  if (typeof baseDir === "string") {
    baseDir = pathResolve(baseDir);
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
          })} in ${baseDir}.`
        );
        if (!tracking || !current) {
          console.error("Error: Not following a remote repository.");
          process.exit(1);
        }

        directoryChangedScripts?.options.forEach((opt) => {
          opt.directory = pathResolve(opt.directory);
        });

        const baseHashes = directoryChangedScripts?.options.map(({ directory }) => {
          console.log(`Listening for changes on ${directory}`);
          return directoryHash(directory);
        });

        const polling = setInterval(async () => {
          await git.remote(["update"]).catch(console.error);

          if (await isItBehind()) {
            clearInterval(polling);

            if (resetRepository) {
              console.log("Reseting GIT Repo to: " + tracking);
              const stashResponse = await git.stash([
                "push",
                "-m",
                `git-polling-worker-ci: ${new Date().toISOString()}`,
              ]);

              console.log(stashResponse);

              await git.reset(ResetMode.HARD, [tracking]);
              await git.checkout(current);
            } else {
              console.log(`Reset repository is disabled.`);
            }

            if (directoryChangedScripts && baseHashes) {
              try {
                if (directoryChangedScripts.parallel) {
                  await Promise.all(
                    directoryChangedScripts.options.map(({ script, directory }, scriptIndex) => {
                      return new Promise<void>(async (resolve, reject) => {
                        try {
                          const didChange =
                            (await baseHashes[scriptIndex]) !== (await directoryHash(directory));

                          if (didChange) {
                            console.log(`${directory} changed, executing script in parallel!`);
                            if (typeof script === "string") {
                              console.log(`$ ${script}`);
                              const cp = exec(script, { async: true });
                              cp.on("close", (code) => {
                                if (code === 0) {
                                  resolve();
                                } else {
                                  reject(Error(`Script "${script}" exit with code ${code}`));
                                }
                              });
                              cp.on("error", (err) => {
                                reject(err);
                              });
                            } else {
                              try {
                                Promise.resolve(script()).then(resolve).catch(reject);
                              } catch (err) {
                                reject(err);
                              }
                            }
                          } else {
                            console.log(`${directory} didn't change!`);
                            resolve();
                          }
                        } catch (err) {
                          reject(err);
                        }
                      });
                    })
                  );
                } else {
                  for (const [
                    scriptIndex,
                    { script, directory },
                  ] of directoryChangedScripts.options.entries()) {
                    const didChange =
                      (await baseHashes[scriptIndex]) !== (await directoryHash(directory));

                    if (didChange) {
                      console.log(`${directory} changed, executing script sequentially!`);
                      if (typeof script === "string") {
                        console.log(`$ ${script}`);
                        const result = exec(script);

                        if (result.code !== 0) {
                          throw Error(`Script "${script}" exit with code ${result.code}`);
                        }
                      } else {
                        await script();
                      }
                    } else {
                      console.log(`${directory} didn't change!`);
                    }
                  }
                }
              } catch (err) {
                console.error(err);
                process.exit(1);
              }
            }

            if (script) {
              console.log(`Executing specified script.`);
              await script();
              if (continueAfterExecution) {
                workerGitCI(args);
              } else {
                process.exit(0);
              }
            } else if (command) {
              console.log(`Executing: "${command}".`);
              const cp = exec(command, { async: true });

              cp.on("close", () => {
                if (continueAfterExecution) {
                  workerGitCI(args);
                } else {
                  process.exit(0);
                }
              });
            }
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
