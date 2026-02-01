#!/bin/bash
#
# Run E2E tests in Daytona sandbox
#
# Usage: ./scripts/run-e2e-daytona.sh [test-filter]
#
# This script:
# 1. Creates a Daytona sandbox with swarm-lite-v1 snapshot
# 2. Clones the repo and builds
# 3. Runs Playwright tests
# 4. Outputs results
# 5. Destroys the sandbox (unless --keep is passed)

set -e

SNAPSHOT="swarm-lite-v1"
REPO_URL="https://github.com/Ianfr13/vibe-kanban.git"
BRANCH="${BRANCH:-dev}"
TEST_FILTER="${1:-}"
KEEP_SANDBOX="${KEEP_SANDBOX:-false}"

echo "🚀 Starting E2E tests in Daytona sandbox..."
echo "   Snapshot: $SNAPSHOT"
echo "   Branch: $BRANCH"
echo "   Test filter: ${TEST_FILTER:-all tests}"

# Check if daytona CLI or MCP is available
if ! command -v daytona &> /dev/null; then
    echo "⚠️  Daytona CLI not found. Using MCP tools instead."
    echo "   Run this script via Claude Code with Daytona MCP configured."
    exit 1
fi

# Create sandbox
echo "📦 Creating sandbox..."
SANDBOX_ID=$(daytona sandbox create --snapshot "$SNAPSHOT" --json | jq -r '.id')
echo "   Sandbox ID: $SANDBOX_ID"

# Clone repo
echo "📥 Cloning repository..."
daytona sandbox exec "$SANDBOX_ID" -- git clone --branch "$BRANCH" "$REPO_URL" /home/daytona/vibe-kanban

# Install dependencies and build
echo "📦 Installing dependencies..."
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban && pnpm install"

echo "🔨 Building frontend..."
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban/frontend && pnpm run build"

echo "🔨 Building backend..."
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban && cargo build --release -p server"

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban/frontend && npx playwright install chromium"

# Start server in background
echo "🖥️  Starting server..."
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban && PORT=8484 ./target/release/server &"
sleep 5

# Run tests
echo "🧪 Running E2E tests..."
if [ -n "$TEST_FILTER" ]; then
    daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban/frontend && npx playwright test --grep '$TEST_FILTER'"
else
    daytona sandbox exec "$SANDBOX_ID" -- bash -c "cd /home/daytona/vibe-kanban/frontend && npx playwright test"
fi

TEST_EXIT_CODE=$?

# Get test results
echo "📊 Test results:"
daytona sandbox exec "$SANDBOX_ID" -- bash -c "cat /home/daytona/vibe-kanban/frontend/playwright-report/index.html" 2>/dev/null || true

# Cleanup
if [ "$KEEP_SANDBOX" != "true" ]; then
    echo "🧹 Destroying sandbox..."
    daytona sandbox destroy "$SANDBOX_ID" --yes
else
    echo "💾 Keeping sandbox: $SANDBOX_ID"
fi

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Exit code: $TEST_EXIT_CODE"
fi

exit $TEST_EXIT_CODE
