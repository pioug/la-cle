> Setup GitHub credentials with SSH to (npm) install private dependencies 🤫 Support macOS, Ubuntu and Windows environments.

This action runs on GitHub's `node24` JavaScript runtime. If you use self-hosted runners, keep them on Actions Runner `v2.327.1` or newer.

### Input parameters

- `GH_SSH_KEY`: Private SSH key. Use [encrypted secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions) to store such information.

### Example of workflow

```yml
on: push
name: Deploy something
jobs:
  build:
    name: Run scripts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pioug/la-cle@v1.3.4
        with:
          GH_SSH_KEY: ${{ secrets.GH_SSH_KEY }}
      - run: npm ci
```
