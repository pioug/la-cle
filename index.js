"use strict";

const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("@actions/core");

async function run() {
  try {
    const homeDirectory = os.homedir();
    const sshDirectory = path.join(homeDirectory, ".ssh");
    const GH_SSH_KEY = core.getInput("GH_SSH_KEY", { required: true });
    fs.mkdirSync(sshDirectory, { recursive: true, mode: 0o700 });

    const id_rsa = path.join(sshDirectory, "pioug_la_cle");
    fs.writeFileSync(id_rsa, `${GH_SSH_KEY}\n`, { mode: 0o600 });

    const config = path.join(sshDirectory, 'config');
    const IdentityFile = `IdentityFile ${id_rsa}`;
    if (!fs.existsSync(config) || !fs.readFileSync(config).includes(IdentityFile)) {
      fs.appendFileSync(config, `\n${IdentityFile}`);
    }

    await exec(`ssh-keyscan -H github.com > ${path.join(sshDirectory, 'known_hosts')}`);

    const cmd =
      {
        darwin: `eval $(ssh-agent -s) && ssh-add -K ${id_rsa}`,
        win32: ":",
      }[process.platform] || `eval $(ssh-agent -s) && ssh-add ${id_rsa}`;
    await exec(cmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
