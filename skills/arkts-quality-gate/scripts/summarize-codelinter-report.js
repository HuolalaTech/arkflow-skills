#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    reportJson: '',
    projectRoot: process.cwd(),
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
    if (key === '--report-json') {
      args.reportJson = value;
    } else if (key === '--project-root') {
      args.projectRoot = value;
    } else {
      throw new Error(`Unknown argument: ${key}`);
    }
  }

  if (!args.reportJson) {
    throw new Error('Missing required argument: --report-json');
  }

  args.reportJson = path.resolve(args.reportJson);
  args.projectRoot = path.resolve(args.projectRoot);
  return args;
}

function severityBucket(sev) {
  const s = String(sev || '').toLowerCase();
  if (s === 'error') {
    return 'error';
  }
  if (s === 'warn' || s === 'warning') {
    return 'warn';
  }
  if (s === 'suggestion' || s === 'info') {
    return 'suggestion';
  }
  return 'warn';
}

function severityRank(sev) {
  const b = severityBucket(sev);
  if (b === 'error') {
    return 0;
  }
  if (b === 'warn') {
    return 1;
  }
  return 2;
}

function toPosixRel(projectRoot, filePath) {
  const fp = String(filePath || '');
  const prefix = projectRoot + path.sep;
  const rel = fp.startsWith(prefix) ? path.relative(projectRoot, fp) : fp;
  return rel.split(path.sep).join('/');
}

function escapePipeField(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function computeSummary(report, projectRoot) {
  if (!Array.isArray(report)) {
    throw new Error('Report root must be a JSON array');
  }
  const root = path.resolve(projectRoot || process.cwd());

  const counters = { errors: 0, warnings: 0, suggestions: 0 };
  const byRule = {};
  const flat = [];

  for (const entry of report) {
    const rel = toPosixRel(root, entry.filePath);
    const messages = Array.isArray(entry.messages) ? entry.messages : [];
    for (const m of messages) {
      const bucket = severityBucket(m.severity);
      if (bucket === 'error') {
        counters.errors += 1;
      } else if (bucket === 'warn') {
        counters.warnings += 1;
      } else {
        counters.suggestions += 1;
      }
      const rule = m.rule || '(no-rule)';
      byRule[rule] = (byRule[rule] || 0) + 1;
      flat.push({
        file: rel,
        line: m.line,
        column: m.column,
        severity: m.severity || bucket,
        rule,
        message: String(m.message || ''),
      });
    }
  }

  flat.sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (ra !== rb) {
      return ra - rb;
    }
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return (a.line || 0) - (b.line || 0);
  });

  const topIssues = flat.slice(0, 5).map((issue) => ({
    file: issue.file,
    line: issue.line,
    column: issue.column,
    severity: issue.severity,
    rule: issue.rule,
    message: String(issue.message || '').replace(/\s+/g, ' ').trim(),
  }));

  const topRules = Object.entries(byRule)
    .sort((x, y) => y[1] - x[1])
    .slice(0, 5)
    .map(([rule, count]) => ({ rule, count }));

  const filesWithIssues = new Set(flat.map((x) => x.file)).size;

  return {
    errors: counters.errors,
    warnings: counters.warnings,
    suggestions: counters.suggestions,
    issuesTotal: flat.length,
    filesWithIssues,
    byRule,
    topRules,
    topIssues,
  };
}

function formatSummaryStdout(stats) {
  const lines = [];
  const hasStructuredError = hasStructuredErrorInSummary(stats);
  lines.push(`summary_errors=${stats.errors}`);
  lines.push(`summary_warnings=${stats.warnings}`);
  lines.push(`summary_suggestions=${stats.suggestions}`);
  lines.push(`summary_issues_total=${stats.issuesTotal}`);
  lines.push(`summary_files_with_issues=${stats.filesWithIssues}`);
  lines.push(`summary_has_structured_error=${hasStructuredError ? 'true' : 'false'}`);

  for (let i = 0; i < stats.topRules.length; i += 1) {
    const tr = stats.topRules[i];
    lines.push(`summary_top_rule_${i + 1}=${tr.rule}:${tr.count}`);
  }

  for (let i = 0; i < stats.topIssues.length; i += 1) {
    const issue = stats.topIssues[i];
    const msg = escapePipeField(issue.message);
    lines.push(
      `summary_top_issue_${i + 1}=${issue.file}:${issue.line}:${issue.column}|${issue.severity}|${issue.rule}|${msg}`,
    );
  }

  lines.push(`summary_stats_json=${JSON.stringify(stats)}`);
  return lines.join('\n');
}

function hasStructuredErrorInSummary(stats) {
  if (!stats || typeof stats !== 'object') {
    return false;
  }
  const hasErrorByCount = Number(stats.errors || 0) > 0;
  const topIssues = Array.isArray(stats.topIssues) ? stats.topIssues : [];
  const hasErrorByTopIssues = topIssues.some((issue) => severityBucket(issue && issue.severity) === 'error');
  return hasErrorByCount || hasErrorByTopIssues;
}

function summarizeReportFile(reportJsonPath, projectRoot) {
  const raw = fs.readFileSync(path.resolve(reportJsonPath), 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in report: ${e.message}`);
  }
  return computeSummary(data, projectRoot);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }

  let stats;
  try {
    stats = summarizeReportFile(args.reportJson, args.projectRoot);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  console.log(formatSummaryStdout(stats));
}

module.exports = {
  computeSummary,
  formatSummaryStdout,
  hasStructuredErrorInSummary,
  summarizeReportFile,
  severityBucket,
  escapePipeField,
};

if (require.main === module) {
  main();
}
