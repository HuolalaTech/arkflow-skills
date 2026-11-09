# Contributing to ArkFlow

Thank you for contributing to ArkFlow, an open-source project from Huolala.

## Before you start

- Read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Search existing [Issues](https://github.com/HuolalaTech/arkflow/issues) / PRs to avoid duplicates
- For security issues, follow [SECURITY.md](./SECURITY.md) (no public issues)

## Development setup

See [README.md](./README.md) / [README_EN.md](./README_EN.md).

This repository is an [Agent Skills](https://agentskills.io/) package. After cloning, install into a HarmonyOS sample app to verify behavior:

```bash
npx skills add HuolalaTech/arkflow -a cursor
```

Do not vendor DevEco Studio / CodeGenie built-in rules or Huawei handbook body text into `skills/arkts-style-core/references/`. Those paths are official-document **indexes** only; see [NOTICE](./NOTICE).

## Pull requests

1. Fork and create a feature branch from `main`
2. Keep changes focused; update docs when behavior changes
3. Do not commit secrets, internal GitLab URLs, or third-party documentation copies
4. Fill in the PR description and link related issues

## Skill style

- Keep `SKILL.md` instructions executable and short; put details in `references/`
- `arkts-basic-rules.md` and `arkts-basic-guide.md` must remain indexes (links + search keywords), not reproduced official manuals
- Team-specific conventions belong in `extra-arkts-conventions.template.md`

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](./LICENSE), Copyright 深圳依时货拉拉科技有限公司.
