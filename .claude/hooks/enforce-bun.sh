#!/bin/bash
# Hook: Enforce bun over npm/npx/yarn/pnpm
# Source rule: "This is a bun project. Use Bun."
# Type: PreToolUse | Matcher: Bash

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only check Bash commands
if [ "$TOOL" != "Bash" ]; then
  exit 0
fi

# Check the full command string for npm/npx/yarn/pnpm as a command (not substring)
# Allow: npx playwright, npx tsc, npx next (tools that need npx)

# Check npm
if echo "$COMMAND" | grep -qE '(^|[;&|] *)npm[[:space:]]'; then
  echo "Blocked: Use bun instead of npm. This is a bun project." >&2
  echo "  npm install → bun install" >&2
  echo "  npm run X   → bun run X" >&2
  echo "  npm test    → bun test" >&2
  exit 2
fi

# Check npx (allow playwright, tsc, next as exceptions)
if echo "$COMMAND" | grep -qE '(^|[;&|] *)npx[[:space:]]'; then
  if echo "$COMMAND" | grep -qE '(^|[;&|] *)npx[[:space:]]+(playwright|tsc|next)'; then
    exit 0
  fi
  echo "Blocked: Use bunx instead of npx. This is a bun project." >&2
  echo "  npx X → bunx X" >&2
  exit 2
fi

# Check yarn
if echo "$COMMAND" | grep -qE '(^|[;&|] *)yarn([[:space:]]|$)'; then
  echo "Blocked: Use bun instead of yarn. This is a bun project." >&2
  exit 2
fi

# Check pnpm
if echo "$COMMAND" | grep -qE '(^|[;&|] *)pnpm([[:space:]]|$)'; then
  echo "Blocked: Use bun instead of pnpm. This is a bun project." >&2
  exit 2
fi

exit 0
