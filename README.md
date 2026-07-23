# La clé

Configure SSH authentication for private GitHub dependencies on Linux, macOS,
and Windows runners.

```yaml
steps:
  - uses: actions/checkout@v6
  - uses: pioug/la-cle@v1.3.4
    with:
      GH_SSH_KEY: ${{ secrets.GH_SSH_KEY }}
  - run: npm ci
```

`GH_SSH_KEY` is required. Store it as an encrypted Actions secret and use a
dedicated, passphrase-free deploy key limited to the repositories the workflow
needs. Do not use a personal SSH key.

The action writes the key to `~/.ssh/pioug_la_cle`, adds it to the SSH config,
and replaces `known_hosts` with GitHub's current host keys. On Linux and macOS,
it reuses an available `ssh-agent` or starts one if needed; Windows uses the
configured identity file directly.

Existing unrelated SSH config entries are preserved. The input name, key path,
and overwrite behavior are unchanged from previous releases.

The action uses Node 24. Self-hosted runners need Actions Runner `v2.327.1` or
newer and OpenSSH tools on `PATH`.
