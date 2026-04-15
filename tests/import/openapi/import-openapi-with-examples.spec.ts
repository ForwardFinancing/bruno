import { test, expect } from '../../../playwright';
import * as path from 'path';
import { closeAllCollections, openCollection } from '../../utils/page';

test.describe('Import OpenAPI Collection with Examples', () => {
  let originalShowOpenDialog;

  test.beforeAll(async ({ electronApp }) => {
    // save the original showOpenDialog function
    await electronApp.evaluate(({ dialog }) => {
      originalShowOpenDialog = dialog.showOpenDialog;
    });
  });

  test.afterAll(async ({ electronApp, page }) => {
    await closeAllCollections(page);
    // restore the original showOpenDialog function
    await electronApp.evaluate(({ dialog }) => {
      dialog.showOpenDialog = originalShowOpenDialog;
    });
  });

  test('should import OpenAPI collection with examples successfully', async ({ page, electronApp, createTmpDir }) => {
    const openApiFile = path.resolve(__dirname, 'fixtures', 'openapi-with-examples.yaml');

    // Create a temporary directory for the collection to be imported into
    const importDir = await createTmpDir('imported-openapi-collection');

    // Mock the electron dialog to return the import directory selection
    await electronApp.evaluate(({ dialog }, { importDir }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [importDir]
      });
    }, { importDir });

    await test.step('Open import collection modal', async () => {
      await page.getByTestId('collections-header-add-menu').click();
      await page.locator('.tippy-box .dropdown-item').filter({ hasText: 'Import collection' }).click();
    });

    await test.step('Wait for import modal and verify title', async () => {
      const importModal = page.getByRole('dialog');
      await importModal.waitFor({ state: 'visible' });
      await expect(importModal.locator('.bruno-modal-header-title')).toContainText('Import Collection');
    });

    await test.step('Upload OpenAPI collection file using hidden file input', async () => {
      // The "choose a file" button triggers a hidden file input, so we can directly set files on it
      await page.setInputFiles('input[type="file"]', openApiFile);

      // Wait for location modal to appear after file processing
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.waitFor({ state: 'visible', timeout: 10000 });
    });

    await test.step('Verify no parsing errors occurred', async () => {
      const hasError = await page.getByText('Failed to parse the file').isVisible().catch(() => false);
      if (hasError) {
        throw new Error('Collection import failed with parsing error');
      }
    });

    await test.step('Verify Import Collection location modal appears', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await expect(locationModal.locator('.bruno-modal-header-title')).toContainText('Import Collection');
      await expect(locationModal.getByText('API with Examples')).toBeVisible();
    });

    await test.step('Click Browse link to select collection folder', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.getByText('Browse').click();
    });

    await test.step('Complete import by clicking import button', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.getByRole('button', { name: 'Import' }).click();
      await locationModal.waitFor({ state: 'hidden' });
    });

    await test.step('Handle sandbox modal', async () => {
      await openCollection(page, 'API with Examples');
    });

    await test.step('Verify collection name appears in sidebar', async () => {
      const collectionName = page.locator('#sidebar-collection-name').getByText('API with Examples');
      await expect(collectionName).toBeVisible();
    });

    await test.step('Verify GET /users request item exists in sidebar', async () => {
      // GET /users has only response examples (no named request body examples),
      // so it stays as a regular request item rather than becoming a folder.
      const getUsersItem = page.locator('.collection-item-name').getByText('Get all users');
      await expect(getUsersItem).toBeVisible();
    });

    await test.step('Verify POST /users folder exists and contains example request items', async () => {
      const createUserFolder = page.locator('.collection-item-name').getByText('Create a new user');
      await expect(createUserFolder).toBeVisible();

      // Click the folder to expand it and show child request items
      await createUserFolder.click();

      // Check if child request items are visible (one per named request body example)
      const validUserRequest = page.locator('.collection-item-name').getByText('Valid User');
      const invalidUserRequest = page.locator('.collection-item-name').getByText('Invalid User');

      await expect(validUserRequest).toBeVisible();
      await expect(invalidUserRequest).toBeVisible();
    });

    await test.step('Cleanup - close all collections', async () => {
      await closeAllCollections(page);
    });
  });

  test('should import OpenAPI collection with path-based grouping', async ({ page, electronApp, createTmpDir }) => {
    const openApiFile = path.resolve(__dirname, 'fixtures', 'openapi-with-examples.yaml');

    // Create a temporary directory for the collection to be imported into
    const importDir = await createTmpDir('imported-openapi-collection-path');

    // Mock the electron dialog to return the import directory selection
    await electronApp.evaluate(({ dialog }, { importDir }) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [importDir]
      });
    }, { importDir });

    await test.step('Open import collection modal', async () => {
      await page.getByTestId('collections-header-add-menu').click();
      await page.locator('.tippy-box .dropdown-item').filter({ hasText: 'Import collection' }).click();
    });

    await test.step('Wait for import modal and verify title', async () => {
      const importModal = page.getByRole('dialog');
      await importModal.waitFor({ state: 'visible' });
      await expect(importModal.locator('.bruno-modal-header-title')).toContainText('Import Collection');
    });

    await test.step('Upload OpenAPI collection file using hidden file input', async () => {
      await page.setInputFiles('input[type="file"]', openApiFile);

      // Wait for location modal to appear after file processing
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.waitFor({ state: 'visible', timeout: 10000 });
    });

    await test.step('Verify no parsing errors occurred', async () => {
      const hasError = await page.getByText('Failed to parse the file').isVisible().catch(() => false);
      if (hasError) {
        throw new Error('Collection import failed with parsing error');
      }
    });

    await test.step('Verify Import Collection location modal appears', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await expect(locationModal.locator('.bruno-modal-header-title')).toContainText('Import Collection');
      await expect(locationModal.getByText('API with Examples')).toBeVisible();
    });

    await test.step('Select path-based grouping option from dropdown', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');

      // Click on the grouping dropdown to open it
      const groupingDropdown = locationModal.getByTestId('grouping-dropdown');
      await groupingDropdown.click();

      // Wait for dropdown to open and select "Paths" option (note: it's "Paths" not "Path")
      const pathOption = page.getByTestId('grouping-option-path');
      await pathOption.click();
    });

    await test.step('Click Browse link to select collection folder', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.getByText('Browse').click();
    });

    await test.step('Complete import by clicking import button', async () => {
      const locationModal = page.locator('[data-testid="import-collection-location-modal"]');
      await locationModal.getByRole('button', { name: 'Import' }).click();
      await locationModal.waitFor({ state: 'hidden' });
    });

    await test.step('Handle sandbox modal', async () => {
      await openCollection(page, 'API with Examples');
    });

    await test.step('Verify collection name appears in sidebar', async () => {
      const collectionName = page.locator('#sidebar-collection-name').getByText('API with Examples');
      await expect(collectionName).toBeVisible();
    });

    await test.step('Verify path-based grouping structure', async () => {
      // With path-based grouping, requests should be organized by their path
      // users should be a folder containing GET and POST requests
      const usersFolder = page.locator('.collection-item-name').getByText('users');
      await expect(usersFolder).toBeVisible();

      // Click on the users folder to expand it
      await usersFolder.click();

      // Verify that the requests are inside the users folder
      const getUsersRequest = page.locator('.collection-item-name').getByText('Get all users');
      const createUserRequest = page.locator('.collection-item-name').getByText('Create a new user');

      await expect(getUsersRequest).toBeVisible();
      await expect(createUserRequest).toBeVisible();
    });

    await test.step('Verify GET /users request item exists with path-based grouping', async () => {
      // GET /users has only response examples (no named request body examples),
      // so it stays as a regular request item rather than becoming a folder.
      const getUsersItem = page.locator('.collection-item-name').getByText('Get all users');
      await expect(getUsersItem).toBeVisible();
    });
  });
});
