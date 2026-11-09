#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT_NAME = path.basename(__filename);

const EXIT = {
  PARAM: 41,
  MERGE: 42,
  RUNNER: 43,
  RELOCATE: 44,
  SUMMARIZE: 45,
};

const DEVECO_RUNNER = '/Applications/DevEco-Studio.app/Contents/plugins/codelinter/run/index.js';

class PhaseAError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function fail(code, message) {
  throw new PhaseAError(code, message);
}

function parseArgs(argv) {
  const args = {
    projectRoot: '',
    scanPath: '',
    commandLineToolsHome: '',
  };

  const usage = [
    'Usage:',
    '  phase-a-orchestrator.js \\',
    '    --project-root <abs-path> \\',
    '    --scan-path <path> \\',
    '    [--command-line-tools-home <abs-path>]',
    '',
    'Exit codes:',
    `  ${EXIT.PARAM} parameter validation failed`,
    `  ${EXIT.MERGE} merge config step failed`,
    `  ${EXIT.RUNNER} phase-a runner step failed`,
    `  ${EXIT.RELOCATE} artifact relocation step failed`,
    `  ${EXIT.SUMMARIZE} report summarize step failed`,
  ].join('\n');

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '-h' || key === '--help') {
      process.stdout.write(`${usage}\n`);
      process.exit(0);
    }
    if (!key.startsWith('--')) {
      fail(EXIT.PARAM, `unknown argument: ${key}`);
    }
    const value = argv[i + 1];
    if (value === undefined || (typeof value === 'string' && value.startsWith('--'))) {
      fail(EXIT.PARAM, `missing value for argument: ${key}`);
    }
    i += 1;
    if (key === '--project-root') {
      args.projectRoot = value;
    } else if (key === '--scan-path') {
      args.scanPath = value;
    } else if (key === '--command-line-tools-home') {
      args.commandLineToolsHome = value;
    } else {
      fail(EXIT.PARAM, `unknown argument: ${key}`);
    }
  }

  if (!args.projectRoot) {
    fail(EXIT.PARAM, 'missing required arg: --project-root');
  }
  if (!args.scanPath) {
    fail(EXIT.PARAM, 'missing required arg: --scan-path');
  }

  args.projectRoot = path.resolve(args.projectRoot);
  args.scanPath = path.resolve(args.scanPath);
  if (args.commandLineToolsHome) {
    args.commandLineToolsHome = path.resolve(args.commandLineToolsHome);
  }
  return args;
}

function locateSkillDir(projectRoot) {
  const candidates = [
    path.join(projectRoot, '.cursor/skills/arkts-quality-gate'),
    path.join(projectRoot, '.claude/skills/arkts-quality-gate'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  fail(EXIT.PARAM, 'skill dir not found under .cursor/skills or .claude/skills');
  return '';
}

function ensureProjectRoot(projectRoot) {
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    fail(EXIT.PARAM, `project root not found: ${projectRoot}`);
  }
}

function ensureFile(filePath, code, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    fail(code, `${label} not found: ${filePath}`);
  }
}

function ensureExecutable(filePath, code, label) {
  ensureFile(filePath, code, label);
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
  } catch (e) {
    fail(code, `${label} not executable: ${filePath}`);
  }
}

function runMergeStep(projectRoot, skillDir) {
  const baselineCfg = path.join(skillDir, 'src/baseline-code-linter.json5');
  const projectCfg = path.join(projectRoot, 'code-linter.json5');
  const mergedCfg = path.join(projectRoot, 'build/codelinter-merged-config.json');
  ensureFile(baselineCfg, EXIT.PARAM, 'baseline config');
  fs.mkdirSync(path.join(projectRoot, 'build'), { recursive: true });

  let merger;
  try {
    merger = require('./codelinter-merge-config-cli');
  } catch (e) {
    fail(EXIT.MERGE, `failed to load merge-config module: ${e.message}`);
  }

  let result;
  try {
    result = merger.runMerge({
      projectRoot,
      baseline: baselineCfg,
      project: projectCfg,
      out: mergedCfg,
    });
  } catch (e) {
    fail(EXIT.MERGE, `merge config step failed: ${e.message}`);
  }

  process.stdout.write('Merged CodeLinter config generated.\n');
  process.stdout.write(`baseline=${result.baseline}\n`);
  process.stdout.write(`project=${result.project}\n`);
  process.stdout.write(`out=${result.out}\n`);
  return mergedCfg;
}

function runCodelinter(args, mergedCfg, reportJson) {
  const built = {
    runnerSource: '',
    runnerPath: '',
  };
  let cmd;
  let cmdArgs;

  if (fs.existsSync(DEVECO_RUNNER) && fs.statSync(DEVECO_RUNNER).isFile()) {
    built.runnerSource = 'deveco-runjs';
    built.runnerPath = DEVECO_RUNNER;
    cmd = process.execPath;
    cmdArgs = [
      DEVECO_RUNNER,
      '-c', mergedCfg,
      '-o', reportJson,
      '-f', 'json',
      args.scanPath,
    ];
  } else {
    if (!args.commandLineToolsHome) {
      fail(
        EXIT.PARAM,
        'missing required arg: --command-line-tools-home (fallback required when DevEco runner unavailable)',
      );
    }
    const cliPath = path.join(args.commandLineToolsHome, 'codelinter/bin/codelinter');
    ensureExecutable(cliPath, EXIT.RUNNER, 'fallback codelinter');
    built.runnerSource = 'command-line-tools';
    built.runnerPath = cliPath;
    cmd = cliPath;
    cmdArgs = [
      '-c', mergedCfg,
      '-o', reportJson,
      '-f', 'json',
      args.scanPath,
    ];
  }

  const result = spawnSync(cmd, cmdArgs, {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env,
  });
  if (result.error) {
    fail(EXIT.RUNNER, `failed to spawn runner ${built.runnerPath}: ${result.error.message}`);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    fail(EXIT.RUNNER, `runner exited with status ${result.status}: ${built.runnerPath}`);
  }
  if (result.signal) {
    fail(EXIT.RUNNER, `runner terminated by signal ${result.signal}: ${built.runnerPath}`);
  }
  return built;
}

function runSummarizeStep(reportJson, projectRoot) {
  let summarizer;
  try {
    summarizer = require('./summarize-codelinter-report');
  } catch (e) {
    fail(EXIT.SUMMARIZE, `failed to load summarize module: ${e.message}`);
  }

  let stats;
  try {
    stats = summarizer.summarizeReportFile(reportJson, projectRoot);
  } catch (e) {
    fail(EXIT.SUMMARIZE, `report summarize step failed: ${e.message}`);
  }

  return {
    stats,
    stdout: summarizer.formatSummaryStdout(stats),
    hasStructuredError: summarizer.hasStructuredErrorInSummary(stats),
  };
}

function parseKvBlock(text) {
  const out = {};
  const lines = String(text || '').split('\n');
  for (const line of lines) {
    if (!line) {
      continue;
    }
    const idx = line.indexOf('=');
    if (idx <= 0) {
      continue;
    }
    const k = line.slice(0, idx);
    const v = line.slice(idx + 1);
    out[k] = v;
  }
  return out;
}

function runRelocateStep(skillDir, projectRoot, runnerSource, reportJson, commandLineToolsHome) {
  const script = path.join(skillDir, 'scripts/phase-a-relocate-artifacts.sh');
  ensureFile(script, EXIT.PARAM, 'relocate script');

  const cmdArgs = [
    script,
    '--project-root', projectRoot,
    '--report-json', reportJson,
    '--runner-source', runnerSource,
  ];
  if (commandLineToolsHome) {
    cmdArgs.push('--command-line-tools-home', commandLineToolsHome);
  }

  const result = spawnSync('bash', cmdArgs, {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: process.env,
    encoding: 'utf8',
  });
  if (result.error) {
    fail(EXIT.RELOCATE, `failed to spawn relocate: ${result.error.message}`);
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    fail(EXIT.RELOCATE, `relocate exited with status ${result.status}`);
  }

  const kv = parseKvBlock(result.stdout);
  return {
    artifactsPolicy: kv.artifacts_policy || 'none',
    artifactsRelocatedTo: kv.artifacts_relocated_to || '',
    reportJsonArchived: kv.report_json_archived || '',
  };
}

function emitFinalStdout(o) {
  const lines = [];
  lines.push(`runner_source=${o.runnerSource}`);
  lines.push(`runner_path=${o.runnerPath}`);
  lines.push('merged_config_path=build/codelinter-merged-config.json');
  lines.push('report_json=build/codelinter-report.json');
  lines.push(o.summaryStdout);
  lines.push(`fixloop_trigger_reason=${o.hasStructuredError ? 'structured_error' : 'none'}`);
  lines.push(`artifacts_policy=${o.artifactsPolicy}`);
  lines.push(`artifacts_relocated_to=${o.artifactsRelocatedTo}`);
  lines.push(`report_json_archived=${o.reportJsonArchived}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    if (e instanceof PhaseAError) {
      process.stderr.write(`[${SCRIPT_NAME}] ${e.message}\n`);
      process.exit(e.code);
    }
    process.stderr.write(`[${SCRIPT_NAME}] unexpected: ${e.message}\n`);
    process.exit(EXIT.PARAM);
  }

  try {
    ensureProjectRoot(args.projectRoot);
    const skillDir = locateSkillDir(args.projectRoot);
    const reportJson = path.join(args.projectRoot, 'build/codelinter-report.json');

    const mergedCfg = runMergeStep(args.projectRoot, skillDir);
    const runner = runCodelinter(args, mergedCfg, reportJson);
    const summary = runSummarizeStep(reportJson, args.projectRoot);
    const relocate = runRelocateStep(
      skillDir,
      args.projectRoot,
      runner.runnerSource,
      reportJson,
      args.commandLineToolsHome,
    );

    emitFinalStdout({
      runnerSource: runner.runnerSource,
      runnerPath: runner.runnerPath,
      summaryStdout: summary.stdout,
      hasStructuredError: summary.hasStructuredError,
      artifactsPolicy: relocate.artifactsPolicy,
      artifactsRelocatedTo: relocate.artifactsRelocatedTo,
      reportJsonArchived: relocate.reportJsonArchived,
    });
  } catch (e) {
    if (e instanceof PhaseAError) {
      process.stderr.write(`[${SCRIPT_NAME}] ${e.message}\n`);
      process.exit(e.code);
    }
    process.stderr.write(`[${SCRIPT_NAME}] unexpected: ${e.stack || e.message}\n`);
    process.exit(EXIT.RUNNER);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  EXIT,
  parseArgs,
  runMergeStep,
  runCodelinter,
  runSummarizeStep,
  runRelocateStep,
  parseKvBlock,
};
