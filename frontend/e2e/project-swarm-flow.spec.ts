import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Full Project + Swarm Execution Flow
 *
 * This test suite covers the complete workflow:
 * 1. Create a new project with a git repository
 * 2. Create a swarm for task orchestration
 * 3. Create tasks in the swarm
 * 4. Verify task execution
 *
 * Prerequisites (in Daytona sandbox):
 * - Server running on localhost:8484
 * - Git configured (for repo creation)
 * - Daytona API configured (for sandbox execution)
 */

const TEST_PROJECT_NAME = `E2E-Project-${Date.now()}`;
const TEST_SWARM_NAME = `E2E-Swarm-${Date.now()}`;
const TEST_REPO_NAME = `test-repo-${Date.now()}`;

test.describe('Project + Swarm Full Flow', () => {
  test.setTimeout(120000); // 2 minutes for full flow

  test('complete workflow: create project -> create swarm -> create task -> execute', async ({ page }) => {
    // Step 1: Navigate to projects page
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Step 2: Create a new project
    await test.step('Create new project', async () => {
      // Click the create project button (+ icon or "New Project")
      const createButton = page.locator('button').filter({ hasText: /new|create/i }).first();
      if (await createButton.isVisible()) {
        await createButton.click();
      } else {
        // Try the + button in header
        await page.click('button:has([class*="plus"]), button:has-text("+")');
      }

      // Wait for RepoPickerDialog
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });

      // Select "Create New Repository" option
      await page.click('text=Create New Repository');

      // Fill repository name
      await page.fill('input#repo-name', TEST_REPO_NAME);

      // Click Create Repository button
      await page.click('button:has-text("Create Repository")');

      // Wait for project to be created (dialog closes and redirect)
      await page.waitForTimeout(2000);
    });

    // Step 3: Navigate to swarm page and create swarm
    await test.step('Create new swarm', async () => {
      await page.goto('/swarm');
      await page.waitForLoadState('networkidle');

      // Click New Swarm button
      await page.click('button:has-text("New Swarm")');

      // Wait for dialog
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Create New Swarm')).toBeVisible();

      // Fill swarm details
      await page.fill('input#swarm-name', TEST_SWARM_NAME);
      await page.fill('textarea#swarm-description', 'E2E test swarm - automated test execution');

      // Create the swarm
      await page.click('button:has-text("Create Swarm")');

      // Should redirect to swarm detail page
      await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/, { timeout: 10000 });
    });

    // Step 4: Verify swarm detail page loaded
    await test.step('Verify swarm detail page', async () => {
      // Wait for page content
      await page.waitForLoadState('networkidle');

      // Check for main components
      await expect(page.locator('text=Pending').first()).toBeVisible();
      await expect(page.locator('text=Running').first()).toBeVisible();
      await expect(page.locator('text=Completed').first()).toBeVisible();
    });

    // Step 5: Create a task
    await test.step('Create task in swarm', async () => {
      // Find and click the + button in the Pending column
      const pendingColumn = page.locator('text=Pending').first().locator('..');
      const addButton = pendingColumn.locator('button').filter({ has: page.locator('[class*="plus"], svg') });

      if (await addButton.isVisible()) {
        await addButton.click();
      } else {
        // Alternative: look for any + button near Pending
        await page.click('button:near(:text("Pending")):has(svg)');
      }

      // Wait for task to appear
      await page.waitForTimeout(1000);

      // Verify task was created (look for "New Task" text)
      await expect(page.locator('text=New Task')).toBeVisible({ timeout: 5000 });
    });

    // Step 6: Send a message via chat (alternative way to create task)
    await test.step('Send message to swarm chat', async () => {
      // Find the chat input
      const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]');

      if (await chatInput.isVisible()) {
        await chatInput.fill('Create a simple hello world script');
        await chatInput.press('Enter');

        // Wait for message to appear
        await page.waitForTimeout(1000);
      }
    });

    // Step 7: Verify swarm status
    await test.step('Verify swarm is active', async () => {
      // Check for Active status badge
      const statusBadge = page.locator('text=Active, text=active').first();
      await expect(statusBadge).toBeVisible();
    });
  });

  test('create task with description and priority', async ({ page }) => {
    // Navigate to swarm page
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    // Check if there's an existing swarm to use
    const swarmCard = page.locator('[role="button"]').first();

    if (await swarmCard.isVisible()) {
      // Click on existing swarm
      await swarmCard.click();
      await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
    } else {
      // Create a new swarm first
      await page.click('button:has-text("New Swarm")');
      await page.fill('input#swarm-name', `Task-Test-Swarm-${Date.now()}`);
      await page.click('button:has-text("Create Swarm")');
      await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
    }

    // Wait for detail page to load
    await page.waitForLoadState('networkidle');

    // Create task via API call (more reliable for testing)
    const swarmId = page.url().split('/swarm/')[1];

    // Use the + button to create a task
    await page.click('button:has(svg[class*="plus"]), button:near(:text("Pending")):first-of-type');
    await page.waitForTimeout(500);

    // Verify task appeared
    const taskCount = await page.locator('[class*="task"], [class*="card"]').count();
    expect(taskCount).toBeGreaterThan(0);
  });
});

test.describe('Swarm Task Execution', () => {
  test.setTimeout(180000); // 3 minutes for execution tests

  test('task moves through execution states', async ({ page }) => {
    // This test requires a configured Daytona sandbox
    // Skip if not in Daytona environment
    const isDaytona = process.env.DAYTONA_SANDBOX === 'true';

    if (!isDaytona) {
      test.skip();
      return;
    }

    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    // Create or select a swarm
    let swarmCard = page.locator('[role="button"]').first();
    if (!(await swarmCard.isVisible())) {
      await page.click('button:has-text("New Swarm")');
      await page.fill('input#swarm-name', `Execution-Test-${Date.now()}`);
      await page.click('button:has-text("Create Swarm")');
    } else {
      await swarmCard.click();
    }

    await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle');

    // Create a task that will actually execute
    await page.click('button:has(svg)'); // + button
    await page.waitForTimeout(1000);

    // Watch for task state changes
    // Task should move: pending -> running -> completed

    // Wait for running state (up to 30 seconds)
    const runningTask = page.locator('text=Running').first();
    await expect(runningTask).toBeVisible({ timeout: 30000 });

    // Wait for completed state (up to 60 seconds)
    const completedTask = page.locator('text=Completed').first();
    await expect(completedTask).toBeVisible({ timeout: 60000 });
  });

  test('can pause and resume swarm during execution', async ({ page }) => {
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    // Select or create swarm
    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();
    } else {
      await page.click('button:has-text("New Swarm")');
      await page.fill('input#swarm-name', `Pause-Test-${Date.now()}`);
      await page.click('button:has-text("Create Swarm")');
    }

    await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle');

    // Test pause functionality
    const pauseButton = page.locator('button:has-text("Pause")');
    const resumeButton = page.locator('button:has-text("Resume")');

    if (await pauseButton.isVisible()) {
      await pauseButton.click();
      await expect(resumeButton).toBeVisible({ timeout: 5000 });

      // Resume
      await resumeButton.click();
      await expect(pauseButton).toBeVisible({ timeout: 5000 });
    } else if (await resumeButton.isVisible()) {
      await resumeButton.click();
      await expect(pauseButton).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('API-driven Task Creation', () => {
  test('create task via API and verify in UI', async ({ page, request }) => {
    // First, get or create a swarm via API
    const swarmsResponse = await request.get('/api/swarms');
    let swarms = await swarmsResponse.json();

    let swarmId: string;

    if (swarms.length === 0) {
      // Create a new swarm
      const createResponse = await request.post('/api/swarms', {
        data: {
          name: `API-Test-Swarm-${Date.now()}`,
          description: 'Created via E2E API test',
          project_id: null,
        },
      });
      const newSwarm = await createResponse.json();
      swarmId = newSwarm.id;
    } else {
      swarmId = swarms[0].id;
    }

    // Create a task via API
    const taskResponse = await request.post(`/api/swarms/${swarmId}/tasks`, {
      data: {
        title: 'API Created Task',
        description: 'This task was created via the API for E2E testing',
        priority: 'high',
        depends_on: null,
        tags: ['e2e', 'test'],
      },
    });

    expect(taskResponse.ok()).toBeTruthy();
    const task = await taskResponse.json();

    // Now verify in UI
    await page.goto(`/swarm/${swarmId}`);
    await page.waitForLoadState('networkidle');

    // Look for the task we created
    await expect(page.locator('text=API Created Task')).toBeVisible({ timeout: 5000 });
  });

  test('task lifecycle: create -> update -> complete', async ({ request }) => {
    // Get or create swarm
    const swarmsResponse = await request.get('/api/swarms');
    let swarms = await swarmsResponse.json();

    let swarmId: string;
    if (swarms.length === 0) {
      const createResponse = await request.post('/api/swarms', {
        data: {
          name: `Lifecycle-Test-${Date.now()}`,
          description: null,
          project_id: null,
        },
      });
      const newSwarm = await createResponse.json();
      swarmId = newSwarm.id;
    } else {
      swarmId = swarms[0].id;
    }

    // Create task
    const createTaskResponse = await request.post(`/api/swarms/${swarmId}/tasks`, {
      data: {
        title: 'Lifecycle Test Task',
        description: 'Testing task state transitions',
        priority: 'medium',
        depends_on: null,
        tags: null,
      },
    });
    expect(createTaskResponse.ok()).toBeTruthy();
    const task = await createTaskResponse.json();

    // Update task (simulate running)
    const updateResponse = await request.put(`/api/swarms/${swarmId}/tasks/${task.id}`, {
      data: {
        title: null,
        description: null,
        status: 'running',
        priority: null,
        sandbox_id: null,
        depends_on: null,
        triggers_after: null,
        result: null,
        error: null,
        tags: null,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();

    // Complete task
    const completeResponse = await request.put(`/api/swarms/${swarmId}/tasks/${task.id}`, {
      data: {
        title: null,
        description: null,
        status: 'completed',
        priority: null,
        sandbox_id: null,
        depends_on: null,
        triggers_after: null,
        result: JSON.stringify({ success: true, output: 'Task completed successfully' }),
        error: null,
        tags: null,
      },
    });
    expect(completeResponse.ok()).toBeTruthy();

    // Verify final state
    const getResponse = await request.get(`/api/swarms/${swarmId}/tasks/${task.id}`);
    const finalTask = await getResponse.json();
    expect(finalTask.status).toBe('completed');
  });
});

test.describe('Chat and Execution Logs', () => {
  test('send message and receive response', async ({ page }) => {
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    // Get into a swarm detail page
    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();
    } else {
      await page.click('button:has-text("New Swarm")');
      await page.fill('input#swarm-name', `Chat-Test-${Date.now()}`);
      await page.click('button:has-text("Create Swarm")');
    }

    await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
    await page.waitForLoadState('networkidle');

    // Find chat panel/input
    const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();

    if (await chatInput.isVisible()) {
      // Send a test message
      await chatInput.fill('Hello from E2E test!');
      await chatInput.press('Enter');

      // Wait and verify message appears
      await page.waitForTimeout(1000);

      // Check for sent message in chat
      await expect(page.locator('text=Hello from E2E test!')).toBeVisible({ timeout: 5000 });
    }
  });

  test('view execution logs for task', async ({ page }) => {
    await page.goto('/swarm');
    await page.waitForLoadState('networkidle');

    const swarmCard = page.locator('[role="button"]').first();
    if (await swarmCard.isVisible()) {
      await swarmCard.click();
      await expect(page).toHaveURL(/\/swarm\/[a-f0-9-]+/);
      await page.waitForLoadState('networkidle');

      // Look for task card with execution button
      const taskCard = page.locator('[class*="task"], [class*="card"]').first();
      if (await taskCard.isVisible()) {
        // Try to click on it or find view button
        const viewButton = taskCard.locator('button').first();
        if (await viewButton.isVisible()) {
          await viewButton.click();
          // Check if logs panel opens
          await page.waitForTimeout(500);
        }
      }
    }
  });
});

test.describe('Cleanup', () => {
  test.afterAll(async ({ request }) => {
    // Clean up test swarms
    try {
      const swarmsResponse = await request.get('/api/swarms');
      const swarms = await swarmsResponse.json();

      for (const swarm of swarms) {
        if (swarm.name.startsWith('E2E-') ||
            swarm.name.startsWith('API-Test-') ||
            swarm.name.startsWith('Lifecycle-') ||
            swarm.name.startsWith('Chat-Test-') ||
            swarm.name.startsWith('Task-Test-') ||
            swarm.name.startsWith('Pause-Test-') ||
            swarm.name.startsWith('Execution-Test-')) {
          await request.delete(`/api/swarms/${swarm.id}`);
        }
      }
    } catch (e) {
      console.log('Cleanup error (non-fatal):', e);
    }
  });
});
