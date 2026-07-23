'use strict'

const { execFile } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')

const exec = promisify(execFile)
const host = 'github.com'

function workflowCommand(name, value) {
  const escaped = String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A')
  console.log(`::${name}::${escaped}`)
}

function exportVariable(name, value) {
  const environmentFile = process.env.GITHUB_ENV
  if (!environmentFile) throw new Error('GITHUB_ENV is not available')

  process.env[name] = value
  fs.appendFileSync(environmentFile, `${name}=${value}${os.EOL}`)
}

async function hasUsableAgent() {
  if (!process.env.SSH_AUTH_SOCK) return false

  try {
    await exec('ssh-add', ['-l'])
    return true
  } catch (error) {
    // ssh-add exits with 1 when the agent is reachable but has no identities.
    return error && typeof error === 'object' && error.code === 1
  }
}

async function run() {
  try {
    const privateKey = (process.env.INPUT_GH_SSH_KEY || '').trim()
    if (!privateKey) {
      throw new Error('Input required and not supplied: GH_SSH_KEY')
    }

    workflowCommand('add-mask', privateKey)
    console.log('Configuring SSH authentication for GitHub')

    const sshDirectory = path.join(os.homedir(), '.ssh')
    const keyPath = path.join(sshDirectory, 'pioug_la_cle')
    const configPath = path.join(sshDirectory, 'config')
    const knownHostsPath = path.join(sshDirectory, 'known_hosts')

    fs.mkdirSync(sshDirectory, { recursive: true, mode: 0o700 })
    fs.writeFileSync(keyPath, `${privateKey}\n`, { mode: 0o600 })
    if (process.platform !== 'win32') {
      fs.chmodSync(sshDirectory, 0o700)
      fs.chmodSync(keyPath, 0o600)
    }

    const identity = `IdentityFile ${keyPath}`
    const config = fs.existsSync(configPath)
      ? fs.readFileSync(configPath, 'utf8')
      : ''
    if (!config.includes(identity)) {
      fs.appendFileSync(configPath, `\n${identity}`, { mode: 0o600 })
    }

    if (process.platform === 'win32') {
      const response = await fetch('https://api.github.com/meta', {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'pioug/la-cle',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        signal: AbortSignal.timeout(10_000)
      })
      if (!response.ok) {
        throw new Error(`GitHub Meta API returned ${response.status}`)
      }

      const { ssh_keys: keys } = await response.json()
      if (
        !Array.isArray(keys) ||
        !keys.length ||
        !keys.every(
          (key) => typeof key === 'string' && key && !/[\r\n]/u.test(key)
        )
      ) {
        throw new Error('GitHub Meta API returned invalid SSH host keys')
      }

      fs.writeFileSync(
        knownHostsPath,
        `${keys.map((key) => `${host} ${key}`).join('\n')}\n`
      )
    } else {
      const { stdout: knownHosts } = await exec('ssh-keyscan', ['-H', host])
      fs.writeFileSync(knownHostsPath, knownHosts, { mode: 0o644 })

      const environment = {}
      if (await hasUsableAgent()) {
        environment.SSH_AUTH_SOCK = process.env.SSH_AUTH_SOCK
        console.log('Using the existing ssh-agent')
      } else {
        const { stdout: agent } = await exec('ssh-agent', ['-s'])
        for (const name of ['SSH_AUTH_SOCK', 'SSH_AGENT_PID']) {
          const value = agent.match(new RegExp(`^${name}=([^;]+);`, 'm'))?.[1]
          if (!value) {
            throw new Error(
              'ssh-agent did not return its connection environment'
            )
          }
          environment[name] = value
        }
        console.log('Started a new ssh-agent')
      }

      for (const [name, value] of Object.entries(environment)) {
        exportVariable(name, value)
      }

      await exec(
        'ssh-add',
        process.platform === 'darwin' ? ['-K', keyPath] : [keyPath],
        { env: { ...process.env, ...environment } }
      )
    }

    console.log('SSH authentication is ready')
  } catch (error) {
    workflowCommand('error', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

run()
