#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    projectRoot: process.cwd(),
    baseline: '',
    project: '',
    out: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key.startsWith('--')) {
      continue;
    }
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for argument: ${key}`);
    }
    i += 1;
    if (key === '--project-root') {
      args.projectRoot = value;
    } else if (key === '--baseline') {
      args.baseline = value;
    } else if (key === '--project') {
      args.project = value;
    } else if (key === '--out') {
      args.out = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  const root = path.resolve(args.projectRoot);
  args.projectRoot = root;
  args.baseline = args.baseline
    ? path.resolve(args.baseline)
    : path.join(root, '.cursor/skills/arkts-quality-gate/src/baseline-code-linter.json5');
  args.project = args.project
    ? path.resolve(args.project)
    : path.join(root, 'code-linter.json5');
  args.out = args.out
    ? path.resolve(args.out)
    : path.join(root, 'build/codelinter-merged-config.json');

  return args;
}

function resolveJson5() {
  const candidates = [];
  const pushCandidate = (value) => {
    if (!value || candidates.includes(value)) {
      return;
    }
    candidates.push(value);
  };
  const pushedFromBaseSdk = (baseSdkHome) => {
    if (!baseSdkHome) {
      return;
    }
    pushCandidate(path.join(baseSdkHome, 'ets/build-tools/ets-loader/node_modules/json5'));
  };

  // Highest priority: user-provided explicit module path.
  pushCandidate(process.env.JSON5_MODULE_PATH);

  // Typical environment-driven locations.
  pushedFromBaseSdk(process.env.OHOS_BASE_SDK_HOME);
  pushedFromBaseSdk(
    process.env.DEVECO_SDK_HOME
      ? path.join(process.env.DEVECO_SDK_HOME, 'default/openharmony')
      : ''
  );

  // Common fallback for macOS DevEco defaults when env vars are missing.
  pushedFromBaseSdk('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony');

  // Try local dependency as last resort.
  pushCandidate('json5');

  const tried = [];

  for (const id of candidates) {
    tried.push(id);
    try {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      return require(id);
    } catch (_) {
      // Try next candidate.
    }
  }

  throw new Error(
    [
      'Cannot resolve json5 module.',
      `Tried candidates: ${tried.join(', ') || '(none)'}.`,
      'Please set one of the following before re-running:',
      '1) export JSON5_MODULE_PATH="/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/json5"',
      '2) export OHOS_BASE_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony"',
      '3) export DEVECO_SDK_HOME="/Applications/DevEco-Studio.app/Contents/sdk"',
    ].join(' ')
  );
}

function readCfg(filePath, json5) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return {};
  }
  return json5.parse(raw);
}

function uniqueArray(values) {
  return Array.from(new Set(values));
}

function mergeConfig(base, project) {
  return {
    ...base,
    ...project,
    files: uniqueArray([...(base.files || []), ...(project.files || [])]),
    ignore: uniqueArray([...(base.ignore || []), ...(project.ignore || [])]),
    ruleSet: uniqueArray([...(base.ruleSet || []), ...(project.ruleSet || [])]),
    rules: { ...(base.rules || {}), ...(project.rules || {}) },
  };
}

function runMerge(opts) {
  const projectRoot = path.resolve(opts.projectRoot || process.cwd());
  const baseline = opts.baseline
    ? path.resolve(opts.baseline)
    : path.join(projectRoot, '.cursor/skills/arkts-quality-gate/src/baseline-code-linter.json5');
  const project = opts.project
    ? path.resolve(opts.project)
    : path.join(projectRoot, 'code-linter.json5');
  const out = opts.out
    ? path.resolve(opts.out)
    : path.join(projectRoot, 'build/codelinter-merged-config.json');

  const json5 = resolveJson5();
  const baseConfig = readCfg(baseline, json5);
  const projectConfig = readCfg(project, json5);
  const merged = mergeConfig(baseConfig, projectConfig);

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(merged, null, 2)}\n`);

  return { baseline, project, out, merged };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = runMerge(args);

    process.stdout.write(
      [
        `Merged CodeLinter config generated.`,
        `baseline=${result.baseline}`,
        `project=${result.project}`,
        `out=${result.out}`,
      ].join('\n') + '\n'
    );
  } catch (err) {
    process.stderr.write(`ERROR: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  runMerge,
  mergeConfig,
  resolveJson5,
  readCfg,
};

if (require.main === module) {
  main();
}

