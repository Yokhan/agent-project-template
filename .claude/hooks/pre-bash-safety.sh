#!/usr/bin/env bash
# PreToolUse — Enhanced dangerous command blocking for Bash
# Extends the inline grep in settings.json with more patterns and better logging.
# Replaces the inline command in settings.json.

[ "${TEST_MODE:-}" = "1" ] && printf '%s\n' "pre-bash-safety: OK (test mode)" && exit 0

CMD="${COMMAND:-}"
[ -z "$CMD" ] && exit 0

BLOCKED=""

# Match each input line separately, like grep without -z. The original patterns
# use GNU grep's \s, \w, and \b extensions; translate those to Bash ERE forms.
matches() {
  local text=$1 regex=$2 insensitive=${3:-} line nocasematch_was_set=0
  shopt -q nocasematch && nocasematch_was_set=1
  if [ "$insensitive" = "1" ]; then shopt -s nocasematch; else shopt -u nocasematch; fi
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ $line =~ $regex ]]; then
      if [ "$nocasematch_was_set" = "1" ]; then shopt -s nocasematch; else shopt -u nocasematch; fi
      return 0
    fi
  done <<MATCH_INPUT
${text}
MATCH_INPUT
  if [ "$nocasematch_was_set" = "1" ]; then shopt -s nocasematch; else shopt -u nocasematch; fi
  return 1
}

# === Destructive filesystem operations ===
if matches "$CMD" 'rm[[:space:]]+(-[a-zA-Z]*f[a-zA-Z]*[[:space:]]+|--force[[:space:]]+)?(/|~|\$HOME|\.\.)' ; then
  BLOCKED="Destructive rm on root/home/parent directory"
elif matches "$CMD" 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f|rm[[:space:]]+-[a-zA-Z]*f[a-zA-Z]*r' ; then
  # rm -rf without specific safe target
  if ! matches "$CMD" 'rm[[:space:]]+-rf[[:space:]]+(node_modules|dist|build|\.cache|__pycache__|\.next|\.nuxt|target|tmp|\.tmp)' ; then
    BLOCKED="Recursive force delete (rm -rf) on non-standard target"
  fi
fi

# === Git destructive operations ===
if matches "$CMD" 'git[[:space:]]+push[[:space:]]+.*--force|git[[:space:]]+push[[:space:]]+-f([^[:alnum:]_]|$)' ; then
  BLOCKED="Force push"
elif matches "$CMD" 'git[[:space:]]+reset[[:space:]]+--hard' ; then
  BLOCKED="Hard reset"
elif matches "$CMD" 'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f' ; then
  BLOCKED="Git clean (force delete untracked files)"
elif matches "$CMD" 'git[[:space:]]+branch[[:space:]]+-D[[:space:]]+main|git[[:space:]]+branch[[:space:]]+-D[[:space:]]+master' ; then
  BLOCKED="Delete main/master branch"
fi

# === Database destructive operations ===
if matches "$CMD" 'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|INDEX)|TRUNCATE[[:space:]]+TABLE|DELETE[[:space:]]+FROM[[:space:]]+[[:alnum:]_]+[[:space:]]*$' 1 ; then
  BLOCKED="Destructive database operation"
fi

# === Pipe-to-shell (supply chain attack vector) ===
if matches "$CMD" 'curl[[:space:]].*\|[[:space:]]*(ba)?sh|wget[[:space:]].*\|[[:space:]]*(ba)?sh|\|[[:space:]]*bash[[:space:]]+-c' ; then
  BLOCKED="Pipe-to-shell execution (supply chain risk)"
fi

# === System-wide changes ===
if matches "$CMD" 'chmod[[:space:]]+(-R[[:space:]]+)?777|chmod[[:space:]].*u\+s|chown[[:space:]]+-R[[:space:]]+root' ; then
  BLOCKED="Dangerous permission change"
elif matches "$CMD" 'docker[[:space:]]+system[[:space:]]+prune[[:space:]]+-a|docker[[:space:]]+rm[[:space:]]+-f[[:space:]]+\$\(' ; then
  BLOCKED="Docker mass cleanup"
elif matches "$CMD" 'pkill[[:space:]]+-9|killall[[:space:]]+-9|kill[[:space:]]+-9[[:space:]]+-1' ; then
  BLOCKED="Mass process kill"
fi

# === Secret exfiltration ===
if matches "$CMD" 'curl[[:space:]].*(-d|--data).*(\$\(cat|password|secret|token|key)|wget[[:space:]].*(-O[[:space:]]*-|--output-document).*\|' 1 ; then
  BLOCKED="Possible secret exfiltration via HTTP"
fi

# === npm/pip install from unknown sources ===
if matches "$CMD" 'npm[[:space:]]+install[[:space:]]+https?://|pip[[:space:]]+install[[:space:]]+https?://' ; then
  BLOCKED="Package install from URL (verify source first)"
fi

if [ -n "$BLOCKED" ]; then
  echo "{\"block\":true,\"message\":\"🛡️ BLOCKED: $BLOCKED — Review command: $CMD\"}" >&2

  # Log to audit
  if [ -d "tasks" ]; then
    mkdir -p "tasks/audit"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%S")
    echo "{\"ts\":\"$TIMESTAMP\",\"type\":\"command_blocked\",\"reason\":\"$BLOCKED\",\"cmd\":\"$(echo "$CMD" | head -c 200 | sed 's/"/\\"/g')\"}" >> "tasks/audit/security.jsonl"
  fi

  exit 2
fi

exit 0
