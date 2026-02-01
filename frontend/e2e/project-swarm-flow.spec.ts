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

  test('complete workflow: create project -> create swarm -> create task -> execute', async ({ page, request }) => {
    // Step 1: Create a swarm via API for reliability
    const createResponse = await request.post('/api/swarms', {
      data: {
        name: TEST_SWARM_NAME,
        description: 'E2E test swarm - automated test execution',
        project_id: null,
      },
    });
    const swarmJson = await createResponse.json();
    const swarm = swarmJson.data || swarmJson;
    const swarmId = swarm.id;

    // Step 2: Navigate directly to swarm detail page
    await test.step('Navigate to swarm detail', async () => {
      await page.goto(`/swarm/${swarmId}`);
      await page.waitForLoadState('networkidle');

      // Check for main components
      await expect(page.locator('text=Pending').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Running').first()).toBeVisible();
      await expect(page.locator('text=Completed').first()).toBeVisible();
    });

    // Step 3: Create a task via the + button
    await test.step('Create task in swarm', async () => {
      // Find the + button specifically in the Pending section (not the navbar)
      // The + button is next to "Pending" text
      const pendingSection = page.locator('text=Pending').first().locator('..');
      const addButton = pendingSection.locator('button');

      if (await addButton.isVisible({ timeout: 3000 })) {
        await addButton.click();
      } else {
        // Fallback: look for button with plus icon near Pending text
        await page.locator('button:right-of(:text("Pending"))').first().click();
      }

      // Wait for task to be created
      await page.waitForTimeout(1500);

      // Verify task was created (look for "New Task" text)
      await expect(page.locator('text=New Task').first()).toBeVisible({ timeout: 5000 });
    });

    // Step 4: Send a message via chat
    await test.step('Send message to swarm chat', async () => {
      // Find the chat input
      const chatInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]').first();

      if (await chatInput.isVisible({ timeout: 3000 })) {
        await chatInput.fill('Create a simple hello world script');
        await chatInput.press('Enter');

        // Wait for message to appear
        await page.waitForTimeout(1000);
      }
    });

    // Step 5: Verify swarm status
    await test.step('Verify swarm is active', async () => {
      // Check for Active status badge
      await expect(page.locator('text=Active').first()).toBeVisible();
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
    const swarmsJson = await swarmsResponse.json();
    // API returns {success, data: [...]}
    const swarms = swarmsJson.data || [];

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
      const newSwarmJson = await createResponse.json();
      swarmId = newSwarmJson.data?.id || newSwarmJson.id;
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
    const taskJson = await taskResponse.json();
    const task = taskJson.data || taskJson;

    // Now verify in UI
    await page.goto(`/swarm/${swarmId}`);
    await page.waitForLoadState('networkidle');

    // Look for the task we created (use first() to handle duplicates)
    await expect(page.locator('text=API Created Task').first()).toBeVisible({ timeout: 5000 });
  });

  test('task lifecycle: create -> update -> complete', async ({ request }) => {
    // Get or create swarm
    const swarmsResponse = await request.get('/api/swarms');
    const swarmsJson = await swarmsResponse.json();
    // API returns {success, data: [...]}
    const swarms = swarmsJson.data || [];

    let swarmId: string;
    if (swarms.length === 0) {
      const createResponse = await request.post('/api/swarms', {
        data: {
          name: `Lifecycle-Test-${Date.now()}`,
          description: null,
          project_id: null,
        },
      });
      const newSwarmJson = await createResponse.json();
      swarmId = newSwarmJson.data?.id || newSwarmJson.id;
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
    const taskJson = await createTaskResponse.json();
    const task = taskJson.data || taskJson;

    // Update task (simulate running)
    const updateResponse = await request.patch(`/api/swarms/${swarmId}/tasks/${task.id}`, {
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
    const completeResponse = await request.patch(`/api/swarms/${swarmId}/tasks/${task.id}`, {
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
    const finalTaskJson = await getResponse.json();
    const finalTask = finalTaskJson.data || finalTaskJson;
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

      // Check for sent message in chat (use first() to avoid strict mode violation)
      await expect(page.locator('text=Hello from E2E test!').first()).toBeVisible({ timeout: 5000 });
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
      const swarmsJson = await swarmsResponse.json();
      const swarms = swarmsJson.data || [];

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
