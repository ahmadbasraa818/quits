import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const openGroup = async (page: Page, name: string) => {
  await page.goto('./');
  await page.getByRole('button', { name: new RegExp(`^${name}\\.`) }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};

const tab = (page: Page, name: string) => page.getByRole('tab', { name });

test('shows what you are owed across the demo groups', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Quits' })).toBeVisible();
  await expect(page.getByText('¥102,940').first()).toBeVisible();
  for (const name of ['Japan trip', 'Flat 4B', 'Brighton day trip']) {
    await expect(page.getByRole('button', { name: new RegExp(`^${name}\\.`) })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^Brighton day trip\..*Settled up/ })).toBeVisible();
});

test('settles the Japan trip in 4 payments instead of 10', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await tab(page, 'Settle up').click();
  await expect(page.getByTestId('settle-headline')).toHaveText('4 payments settle everyone');
  await expect(page.getByText('Paying back pair by pair would take 10.')).toBeVisible();
  await page.getByRole('tab', { name: 'Pair by pair (10)' }).click();
  await expect(page.getByRole('tab', { name: 'Pair by pair (10)' })).toHaveAttribute('aria-selected', 'true');
});

test('adds an expense split between some of the group', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('4800');
  await page.getByTestId('description').fill('Karaoke');
  await page.getByRole('radio', { name: 'Fun' }).click();
  await page.getByTestId('payer-aiko').click();
  await page.getByRole('checkbox', { name: 'Split with Ben' }).click();
  await page.getByRole('checkbox', { name: 'Split with Dev' }).click();
  // Three people left: You, Aiko and Chloe pay ¥1,600 each.
  await expect(page.getByText('¥1,600')).toHaveCount(3);
  await page.getByTestId('save-expense').click();
  await expect(page.getByRole('button', { name: /^Karaoke, ¥4,800, paid by Aiko, you owe ¥1,600/ })).toBeVisible();
});

test('explains what is wrong with an exact split, and won’t save it', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('30');
  await page.getByTestId('description').fill('Takeaway');
  await page.getByRole('tab', { name: 'Exact' }).click();
  await page.getByTestId('exact-you').fill('10');
  await page.getByTestId('exact-sam').fill('10');
  await expect(page.getByTestId('split-problem')).toHaveText('£10.00 still to assign.');
  await expect(page.getByTestId('save-expense')).toBeDisabled();
  await page.getByTestId('exact-priya').fill('10');
  await expect(page.getByTestId('split-problem')).toHaveCount(0);
  await expect(page.getByTestId('save-expense')).toBeEnabled();
});

test('records every payment until everyone is square', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await tab(page, 'Settle up').click();
  for (let left = 4; left > 0; left -= 1) {
    await page.getByRole('button', { name: 'Mark paid' }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Everyone’s square' })).toBeVisible();
  await tab(page, 'Balances').click();
  await expect(page.getByLabel('You are square')).toBeVisible();
});

test('edits an expense, and the shares follow', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByRole('button', { name: /^Pizza night/ }).click();
  await expect(page.getByRole('heading', { name: 'Edit expense' })).toBeVisible();
  await page.getByTestId('description').fill('Pizza and films');
  await page.getByTestId('amount').fill('45.00');
  await page.getByTestId('save-expense').click();
  // Priya paid £45.00 for three: your share is £15.00.
  await expect(page.getByRole('button', { name: /^Pizza and films, £45\.00, paid by Priya, you owe £15\.00/ })).toBeVisible();
});

test('deletes an expense, and undo brings it back', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByRole('button', { name: /^Pizza night/ }).click();
  await page.getByRole('button', { name: 'Delete expense' }).click();
  await expect(page.getByRole('button', { name: /^Pizza night/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Pizza night/ })).toBeVisible();
});

test('starts a new group and remembers it after a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('new-group').click();
  await page.getByTestId('group-name').fill('Lisbon weekend');
  await page.getByRole('tab', { name: '€ EUR' }).click();
  await page.getByTestId('person-0').fill('Rui');
  await page.getByTestId('person-1').fill('Ana');
  await page.getByTestId('create-group').click();
  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();
  await expect(page.getByText('No expenses yet')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();
});

test('opens a deep link straight to a group', async ({ page }) => {
  await page.goto('group/demo_flat');
  await expect(page.getByRole('heading', { name: 'Flat 4B' })).toBeVisible();
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations on the main screens in ${scheme} mode`, async ({ page }) => {
      // Scan settled screens, not frames of a fade: ask for reduced motion, as some visitors do.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      const scan = async (where: string) => {
        await page.waitForTimeout(600);
        const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(violations.map((v) => `${where}: ${v.id} (${v.nodes.length})`)).toEqual([]);
      };
      await page.goto('./');
      await scan('groups');
      await openGroup(page, 'Japan trip');
      await scan('expenses');
      await tab(page, 'Balances').click();
      await scan('balances');
      await tab(page, 'Settle up').click();
      await scan('settle up');
      await tab(page, 'Expenses').click();
      await page.getByTestId('add-expense').click();
      await scan('add expense');
    });
  }
});
