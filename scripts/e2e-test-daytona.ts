/**
 * E2E Test Runner for Daytona
 *
 * This script is designed to be called from Claude Code with Daytona MCP.
 * It provides instructions for running E2E tests in a Daytona sandbox.
 *
 * Usage (via Claude Code):
 *   1. Create sandbox: mcp__daytona__create_sandbox with snapshot="swarm-lite-v1"
 *   2. Clone repo: mcp__daytona__git_clone url="..." branch="dev"
 *   3. Run setup and tests using mcp__daytona__execute_command
 */

const COMMANDS = {
  // Setup commands
  install: 'cd /home/daytona/vibe-kanban && pnpm install',
  buildFrontend: 'cd /home/daytona/vibe-kanban/frontend && pnpm run build',
  buildBackend: 'cd /home/daytona/vibe-kanban && cargo build --release -p server',
  installPlaywright: 'cd /home/daytona/vibe-kanban/frontend && npx playwright install chromium --with-deps',

  // Server commands
  startServer: 'cd /home/daytona/vibe-kanban && PORT=8484 nohup ./target/release/server > /tmp/server.log 2>&1 &',
  checkServer: 'curl -s http://localhost:8484/api/health',

  // Test commands
  runAllTests: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test',
  runSwarmTests: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test swarm.spec.ts',
  runFullFlowTests: 'cd /home/daytona/vibe-kanban/frontend && DAYTONA_SANDBOX=true npx playwright test project-swarm-flow.spec.ts',
  runHeaded: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test --headed',

  // Specific test suites
  testProjectSwarmFlow: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test "complete workflow"',
  testTaskExecution: 'cd /home/daytona/vibe-kanban/frontend && DAYTONA_SANDBOX=true npx playwright test "task moves through"',
  testApiTasks: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test "API-driven"',
  testChat: 'cd /home/daytona/vibe-kanban/frontend && npx playwright test "Chat and Execution"',

  // Results
  getReport: 'cat /home/daytona/vibe-kanban/frontend/playwright-report/index.html',
  getScreenshots: 'ls -la /home/daytona/vibe-kanban/frontend/test-results/',
};

console.log('E2E Test Commands for Daytona:');
console.log(JSON.stringify(COMMANDS, null, 2));
