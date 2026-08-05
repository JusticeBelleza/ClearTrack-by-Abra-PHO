// e2e/routing.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Handover Sequence', () => {
  test('Prevents handover submission without a signature', async ({ page }) => {
    // 1. Login as PHO Liaison
    await page.goto('/login');
    await page.fill('[name="email"]', 'liaison@pho.gov');
    await page.fill('[name="password"]', 'securepassword123');
    await page.click('button[type="submit"]');

    // 2. Navigate to Active Custody and trigger handover
    await page.click('text=Route Record');
    
    // 3. Fill out destination and clerk name, but SKIP the signature
    await page.click('[role="combobox"]');
    await page.click('text=Governor Office');
    await page.fill('input[placeholder="Receiving Clerk Name"]', 'John Doe');

    // 4. Verify the submit button remains strictly disabled
    const submitBtn = page.locator('button', { hasText: 'Confirm Handover' });
    await expect(submitBtn).toBeDisabled();
  });
});