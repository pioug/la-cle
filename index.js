"use strict";

const { promisify } = require("util");
const exec = promisify(require("child_process").exec);
const fs = require("fs");
const os = require("os");
const path = require("path");
const core = require("@actions/core");

// Some Windows runner OpenSSH builds ship a broken ssh-keyscan.exe that
// fails against GitHub's current KEX set, so Windows pulls host keys from
// the GitHub Meta API instead.
async function getGithubKnownHosts() {
  const response = await fetch("https://api.github.com/meta", {
    headers: {
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  const metadata = await response.json();
  return `${metadata.ssh_keys.map((key) => `github.com ${key}`).join("\n")}\n`;
}

async function run() {
  try {
    const homeDirectory = os.homedir();
    const sshDirectory = path.join(homeDirectory, ".ssh");
    const knownHostsPath = path.join(sshDirectory, "known_hosts");
    const GH_SSH_KEY = core.getInput("GH_SSH_KEY", { required: true });
    fs.mkdirSync(sshDirectory, { recursive: true, mode: 0o700 });

    const id_rsa = path.join(sshDirectory, "pioug_la_cle");
    fs.writeFileSync(id_rsa, `${GH_SSH_KEY}\n`, { mode: 0o600 });

    const config = path.join(sshDirectory, 'config');
    const IdentityFile = `IdentityFile ${id_rsa}`;
    if (!fs.existsSync(config) || !fs.readFileSync(config).includes(IdentityFile)) {
      fs.appendFileSync(config, `\n${IdentityFile}`);
    }

    if (process.platform === "win32") {
      const knownHosts = await getGithubKnownHosts();
      fs.writeFileSync(knownHostsPath, knownHosts);
    } else {
      await exec(`ssh-keyscan -H github.com > "${knownHostsPath}"`);
    }

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
