#!/usr/bin/env bash

set -u

SCRIPT_NAME="$(basename "$0")"

project_root=""
command_line_tools_home=""
report_json=""
runner_source=""

usage() {
  cat <<'EOF'
Usage:
  phase-a-relocate-artifacts.sh \
    --project-root <abs-path> \
    --report-json <path> \
    --runner-source <deveco-runjs|command-line-tools> \
    [--command-line-tools-home <abs-path>]

Exit codes:
  31 parameter validation failed
  32 artifact copy/archive failed
  33 artifact cleanup failed
EOF
}

fail() {
  local code="$1"
  shift
  echo "[${SCRIPT_NAME}] $*" >&2
  exit "${code}"
}

require_non_empty() {
  local name="$1"
  local value="$2"
  if [ -z "${value}" ]; then
    fail 31 "missing required arg: ${name}"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-root)
      project_root="${2:-}"
      shift 2
      ;;
    --command-line-tools-home)
      command_line_tools_home="${2:-}"
      shift 2
      ;;
    --report-json)
      report_json="${2:-}"
      shift 2
      ;;
    --runner-source)
      runner_source="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail 31 "unknown argument: $1"
      ;;
  esac
done

require_non_empty "--project-root" "${project_root}"
require_non_empty "--report-json" "${report_json}"
require_non_empty "--runner-source" "${runner_source}"

if [ "${runner_source}" != "command-line-tools" ]; then
  echo "artifacts_policy=none"
  echo "artifacts_relocated_to="
  echo "report_json_archived="
  exit 0
fi

require_non_empty "--command-line-tools-home (fallback required)" "${command_line_tools_home}"

source_dir="${command_line_tools_home}/codelinter/linter/result"
expected_source_dir="${command_line_tools_home}/codelinter/linter/result"

if [ ! -d "${source_dir}" ]; then
  fail 32 "artifact source not found: ${source_dir}"
fi

if [ ! -f "${report_json}" ]; then
  fail 32 "report json not found: ${report_json}"
fi

ts="$(date +%Y%m%d-%H%M%S)"
archive_rel="build/codelinter-linter-result/archive-${ts}"
archive_abs="${project_root}/${archive_rel}"

if ! mkdir -p "$(dirname "${archive_abs}")"; then
  fail 32 "failed to create archive parent: $(dirname "${archive_abs}")"
fi

if ! cp -a "${source_dir}" "${archive_abs}"; then
  fail 32 "failed to copy artifact dir to: ${archive_abs}"
fi

if ! cp -f "${report_json}" "${archive_abs}/codelinter-report.json"; then
  fail 32 "failed to archive report json into: ${archive_abs}"
fi

if [ -z "${source_dir}" ] || [ "${source_dir}" = "/" ] || [ "${source_dir}" != "${expected_source_dir}" ]; then
  fail 33 "unsafe cleanup target blocked: ${source_dir}"
fi

if ! rm -rf "${source_dir}"; then
  fail 33 "failed to cleanup source artifacts: ${source_dir}"
fi

echo "artifacts_policy=relocate_and_cleanup"
echo "artifacts_relocated_to=${archive_rel}"
echo "report_json_archived=${archive_rel}/codelinter-report.json"
