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
  await expect(page.getByText('¥48,624').first()).toBeVisible();
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
  const arrows = page.getByTestId('settle-graph').locator('line[stroke-opacity="1"]');
  await expect(arrows).toHaveCount(4);
  await page.getByRole('tab', { name: 'Pair by pair (10)' }).click();
  await expect(page.getByRole('tab', { name: 'Pair by pair (10)' })).toHaveAttribute('aria-selected', 'true');
  // The graph redraws: ten arrows, one for every pair that owes.
  await expect(arrows).toHaveCount(10);
  await expect(page.getByTestId('settle-explanation')).toHaveText('5 people are owed or owe, and their balances only cancel out all together, so 4 payments is the fewest possible.');
});

test('records part of a payment, and the plan follows', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await tab(page, 'Settle up').click();
  await page.getByRole('button', { name: 'Aiko pays You ¥29,359' }).click();
  await expect(page.getByLabel('Amount in Japanese yen')).toHaveValue('29359');
  await page.getByLabel('Amount in Japanese yen').fill('10000');
  await expect(page.getByTestId('payment-partial')).toHaveText('Part of the ¥29,359: ¥19,359 will still be owed.');
  await page.getByTestId('payment-note').fill('PayPay');
  await page.getByTestId('save-payment').click();
  await expect(page.getByRole('button', { name: 'Aiko pays You ¥19,359' })).toBeVisible();
  await expect(page.getByLabel(/^Aiko paid you ¥10,000, Today, PayPay$/)).toBeVisible();
});

test('deletes a recorded payment, and undo brings it back', async ({ page }) => {
  await openGroup(page, 'Brighton day trip');
  await tab(page, 'Settle up').click();
  await expect(page.getByRole('heading', { name: 'Everyone’s square' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete the payment: Tom paid Mia £29.50' }).click();
  await expect(page.getByTestId('settle-headline')).toHaveText('One payment settles everyone');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('heading', { name: 'Everyone’s square' })).toBeVisible();
});

test('shares the plan, copying it where the browser can’t share', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'share', { value: undefined }));
  await openGroup(page, 'Japan trip');
  await tab(page, 'Settle up').click();
  await page.getByTestId('share-plan').click();
  await expect(page.getByText('Plan copied, ready to paste')).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(
    [
      'Settling up for Japan trip:',
      '• Chloe pays Ben ¥118,305',
      '• Aiko pays Ben ¥85,146',
      '• Aiko pays me ¥29,359',
      '• Dev pays me ¥19,265',
      '',
      '4 payments instead of 10 pair by pair, worked out with Quits: https://ahmadbasraa818.github.io/quits/',
    ].join('\n')
  );
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
  await expect(page.getByTestId('payments-made').getByRole('button', { name: /^Delete the payment/ })).toHaveCount(4);
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
  await page.getByTestId('currency-field').click();
  await page.getByTestId('currency-search').fill('euro');
  await page.getByRole('radio', { name: 'Euro, EUR' }).click();
  await expect(page.getByRole('button', { name: 'Currency: Euro, EUR' })).toBeVisible();
  await page.getByTestId('person-0').fill('Rui');
  await page.getByTestId('person-1').fill('Ana');
  await page.getByTestId('create-group').click();
  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();
  await expect(page.getByText('No expenses yet')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();
});

test('edits a group: renames it, adds someone, and marks someone as having left', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await page.getByTestId('group-settings').click();
  await expect(page.getByRole('heading', { name: 'Group settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Group currency: Japanese yen, JPY' })).toBeDisabled();
  await page.getByTestId('group-name').fill('Japan, autumn');
  await page.getByTestId('add-member').click();
  await page.getByRole('textbox', { name: 'New person 5' }).fill('Emi');
  await page.getByRole('checkbox', { name: 'Ben left the group' }).click();
  await page.getByTestId('save-group').click();
  await expect(page.getByRole('heading', { name: 'Japan, autumn' })).toBeVisible();
  // Ben is still owed for the JR Passes, but isn't offered for new expenses. Emi is.
  await tab(page, 'Balances').click();
  await expect(page.getByLabel(/^Ben is owed ¥/)).toBeVisible();
  await tab(page, 'Expenses').click();
  await page.getByTestId('add-expense').click();
  await expect(page.getByTestId('payer-aiko')).toBeVisible();
  await expect(page.getByTestId('payer-ben')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Emi' })).toBeVisible();
});

test('won’t save two people with the same name', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('group-settings').click();
  await page.getByTestId('add-member').click();
  await page.getByRole('textbox', { name: 'New person 3' }).fill('sam');
  await expect(page.getByTestId('settings-problem')).toHaveText('There are two people called sam. Add an initial to tell them apart.');
  await expect(page.getByTestId('save-group')).toBeDisabled();
});

test('removes someone who has nothing in the group yet', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('new-group').click();
  await page.getByTestId('group-name').fill('Five-a-side');
  await page.getByTestId('person-0').fill('Kofi');
  await page.getByTestId('person-1').fill('Lena');
  await page.getByTestId('create-group').click();
  await page.getByTestId('group-settings').click();
  await page.getByRole('button', { name: 'Remove Lena' }).click();
  await page.getByTestId('save-group').click();
  await page.getByTestId('add-expense').click();
  await expect(page.getByRole('radio', { name: 'Kofi' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Lena' })).toHaveCount(0);
});

test('deletes a group, and undo brings it back', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('group-settings').click();
  await page.getByTestId('delete-group').click();
  await expect(page.getByRole('heading', { name: 'Delete Flat 4B?' })).toBeVisible();
  await page.getByTestId('confirm').click();
  await expect(page.getByRole('heading', { name: 'Quits' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Flat 4B\./ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Flat 4B\./ })).toBeVisible();
});

test('dates an expense with the calendar, and keeps its note', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('12,40');
  await page.getByTestId('description').fill('Milk and bread');
  await page.getByTestId('date-field').click();
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByTestId('calendar-month')).toHaveText('September 2026');
  await page.getByRole('button', { name: 'Tuesday 15 September 2026' }).click();
  await expect(page.getByRole('button', { name: 'Date: Tuesday 15 September 2026' })).toBeVisible();
  await page.getByTestId('note').fill('From the corner shop');
  await page.getByTestId('save-expense').click();
  await expect(page.getByRole('heading', { name: 'Tue 15 Sep' })).toBeVisible();
  await page.getByRole('button', { name: /^Milk and bread, £12\.40/ }).click();
  await expect(page.getByTestId('note')).toHaveValue('From the corner shop');
});

test.describe('other currencies', () => {
  test('adds an expense paid in euros, at the ECB rate, to a pound group', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
    // The ECB's rates for Friday 2 October, served here rather than over the network.
    await page.route('**/api.frankfurter.dev/v1/**', (route) => {
      const base = new URL(route.request().url()).searchParams.get('base');
      return route.fulfill({ json: base === 'EUR' ? { date: '2026-10-02', rates: { GBP: 0.8692 } } : { date: '2026-10-02', rates: { EUR: 1.1505 } } });
    });
    await openGroup(page, 'Flat 4B');
    await page.getByTestId('add-expense').click();
    await page.getByTestId('expense-currency').click();
    await page.getByTestId('currency-search').fill('euro');
    await page.getByRole('radio', { name: 'Euro, EUR' }).click();
    await page.getByTestId('amount').fill('30');
    await page.getByTestId('description').fill('Museum tickets');
    // EUR to GBP is below one, so the rate is read the other way round. It's a Sunday: Friday's rate.
    await expect(page.getByTestId('rate')).toHaveText('£1 = €1.1505 · ECB rate for Fri 2 Oct, the latest before today');
    // €30 ÷ 1.1505 = £26.0756…
    await expect(page.getByLabel('Comes to £26.08')).toBeVisible();
    await page.getByTestId('save-expense').click();
    // Split €10 each; the £26.08 divides as £8.70, £8.69, £8.69.
    await expect(page.getByRole('button', { name: /^Museum tickets, €30\.00, which is £26\.08, paid by You, you lent £17\.38/ })).toBeVisible();
  });

  test('takes a rate by hand where the ECB has none, and reads it back', async ({ page }) => {
    await openGroup(page, 'Flat 4B');
    await page.getByTestId('add-expense').click();
    await page.getByTestId('expense-currency').click();
    await page.getByTestId('currency-search').fill('dong');
    await page.getByRole('radio', { name: 'Vietnamese đồng, VND' }).click();
    await page.getByTestId('amount').fill('150,000');
    await page.getByTestId('description').fill('Phở in Hanoi');
    await expect(page.getByTestId('rate-unavailable')).toHaveText('The ECB doesn’t publish a rate for Vietnamese đồng, so enter it yourself.');
    await expect(page.getByTestId('save-expense')).toBeDisabled();
    await page.getByLabel('How many Vietnamese đồng one British pound buys').fill('33,000');
    await expect(page.getByTestId('rate-preview')).toHaveText('Reads as £1 = ₫33,000');
    await page.getByRole('button', { name: 'Use this rate' }).click();
    // ₫150,000 ÷ 33,000 = £4.5454…
    await expect(page.getByLabel('Comes to £4.55')).toBeVisible();
    await page.getByTestId('save-expense').click();
    await expect(page.getByRole('button', { name: /^Phở in Hanoi, ₫150,000, which is £4\.55/ })).toBeVisible();
  });

  test('keeps the rate an expense was saved with', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    // £1,310.00 at £1 = ¥207.31 is ¥271,576.10; five ways, your share takes the leftover yen.
    await page.getByRole('button', { name: /^JR Passes, bought at home, £1,310\.00, which is ¥271,576, paid by Ben, you owe ¥54,316/ }).click();
    await expect(page.getByTestId('rate')).toHaveText('£1 = ¥207.31 · The rate it was saved with');
    await expect(page.getByLabel('Comes to ¥271,576')).toBeVisible();
  });

  test('says when there’s no connection, and offers to try again', async ({ page }) => {
    await page.route('**/api.frankfurter.dev/v1/**', (route) => route.abort('internetdisconnected'));
    await openGroup(page, 'Flat 4B');
    await page.getByTestId('add-expense').click();
    await page.getByTestId('expense-currency').click();
    await page.getByTestId('currency-search').fill('USD');
    await page.getByRole('radio', { name: 'US dollar, USD' }).click();
    await expect(page.getByTestId('rate-unavailable')).toHaveText('No connection to look up the rate. Enter it yourself, or try again.');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

test.describe('understanding the money', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  });

  test('shows where the money went', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await page.getByTestId('spending-strip').click();
    await expect(page.getByRole('heading', { name: 'Spending' })).toBeVisible();
    await expect(page.getByTestId('spending-summary')).toHaveText('11 expenses over 12 days, about ¥59,299 a day');
    await expect(page.getByLabel('Transport: ¥351,326, 49%, 3 expenses')).toBeVisible();
    await expect(page.getByLabel('Other: ¥1,000, <1%, 1 expense')).toBeVisible();
    await expect(page.getByTestId('busiest')).toHaveText('Busiest day: Thu 27 Aug, ¥271,576');
    await page.getByRole('button', { name: 'Saturday 5 September 2026: ¥126,000 on 1 expense' }).click();
    await expect(page.getByTestId('busiest')).toHaveText('Sat 5 Sep: ¥126,000');
    await expect(page.getByRole('button', { name: 'Aiko paid ¥29,200 and used ¥143,705' })).toBeVisible();
  });

  test('explains a balance line by line', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await tab(page, 'Balances').click();
    await page.getByRole('button', { name: 'Aiko owes ¥114,505' }).click();
    await expect(page.getByTestId('standing')).toHaveText('Aiko owes ¥114,505');
    await expect(page.getByLabel('Paid for: ¥29,200')).toBeVisible();
    await expect(page.getByLabel('Their share: ¥143,705')).toBeVisible();
    await expect(page.getByTestId('balance')).toHaveText('-¥114,505');
    await expect(page.getByRole('button', { name: 'JR Passes, bought at home, Thu 27 Aug · share ¥54,315: -¥54,315' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'teamLab Planets, Tue 1 Sep · paid ¥19,200, share ¥3,840: +¥15,360' })).toBeVisible();
  });

  test('finds expenses by name and by category', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await page.getByLabel('Search expenses').fill('ramen');
    await expect(page.getByTestId('filter-summary')).toHaveText('1 expense · ¥7,480');
    await page.getByTestId('clear-filter').click();
    await page.getByRole('radio', { name: 'Stay' }).click();
    await expect(page.getByTestId('filter-summary')).toHaveText('2 expenses · ¥294,000');
    await expect(page.getByRole('button', { name: /^Ryokan, two nights/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ichiran ramen/ })).toHaveCount(0);
  });
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
      await page.getByTestId('record-payment-button').click();
      await scan('record a payment');
      await page.keyboard.press('Escape');
      await tab(page, 'Expenses').click();
      await page.getByTestId('add-expense').click();
      await scan('add expense');
      await page.getByTestId('expense-currency').click();
      await page.getByTestId('currency-search').fill('VND');
      await page.getByRole('radio', { name: 'Vietnamese đồng, VND' }).click();
      await scan('conversion');
      await page.getByTestId('date-field').click();
      await scan('date sheet');
      await page.goto('group/demo_japan/spending');
      await scan('spending');
      await page.goto('group/demo_japan/member/aiko');
      await scan('statement');
      await page.goto('group/demo_japan/settings');
      await scan('group settings');
      await page.getByTestId('delete-group').click();
      await scan('confirm delete');
      await page.goto('new-group');
      await page.getByTestId('currency-field').click();
      await scan('currency picker');
    });
  }
});
