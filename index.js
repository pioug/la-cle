"use strict";

const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const core = require("@actions/core");

async function run() {
  try {
    const GH_SSH_KEY = core.getInput("GH_SSH_KEY", { required: true });
    [
      "mkdir -p ~/.ssh",
      "chmod 700 ~/.ssh",
      "touch ~/.ssh/known_hosts",
      "ssh-keyscan github.com >> ~/.ssh/known_hosts",
      "chmod 600 ~/.ssh/known_hosts",
      `echo "${GH_SSH_KEY}" > ~/.ssh/id_rsa`,
      "chmod 600 ~/.ssh/id_rsa",
      "eval $(ssh-agent -s) && ssh-add ~/.ssh/id_rsa"
    ].reduce(async (acc, cmd) => {
      await acc;
      return exec(cmd);
    }, Promise.resolve({}));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
