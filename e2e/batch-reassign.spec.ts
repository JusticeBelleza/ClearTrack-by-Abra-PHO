import { test, expect } from '@playwright/test';

test('User can log in and successfully batch re-assign a document', async ({ page }) => {
  // 1. Navigate to the app (Playwright now knows this means http://localhost:5173/)
  await page.goto('/');

  // 2. Perform the Login Sequence
   // Update these with a REAL user's credentials from your database
   await page.getByPlaceholder('name@abra.gov.ph').fill('actual_user@abra.gov.ph');
   await page.getByPlaceholder('••••••••').fill('ActualPassword123!'); 
   await page.getByRole('button', { name: 'Sign In' }).click();

   // 3. Explicitly wait for the auth redirect to the dashboard or admin page
   await page.waitForURL(/dashboard|admin/); 

   // 4. NOW explicitly navigate to the processing page
   await page.goto('/processing');

  // 5. Wait for the Processing page to fully load
  await expect(page.getByRole('heading', { name: 'Active Processing' })).toBeVisible();

  // 6. Select a document 
  await page.locator('input[type="checkbox"]').first().click();

  // 7. Select a colleague from the custom dropdown
  await page.getByText('Choose an employee...').click();
  await page.getByText('Leila Bernal').click(); // Update to a real colleague's name

  // 8. Click confirm
  await page.getByRole('button', { name: 'Confirm Re-assign' }).click();

  // 9. Verify the success toast appears
  await expect(page.getByText('Successfully processed')).toBeVisible();
});