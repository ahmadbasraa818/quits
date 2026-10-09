import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

import app from '../app.json';

const openGroup = async (page: Page, name: string) => {
  await page.goto('./');
  await page.getByRole('button', { name: new RegExp(`^${name}\\.`) }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
};

const tab = (page: Page, name: string) => page.getByRole('tab', { name });

/** Opens Quits, once, as someone who already has these groups and has seen what's new. */
const seedGroups = (page: Page, groups: unknown[]) =>
  page.addInitScript(
    ([saved, settings]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('quits', saved);
        localStorage.setItem('quits-settings', settings);
        sessionStorage.setItem('seeded', 'yes');
      }
    },
    [JSON.stringify({ state: { groups }, version: 3 }), JSON.stringify({ state: { welcomeDone: true, seenVersion: app.expo.version }, version: 0 })]
  );

/** Pay links open the service's own site; tests get a stand-in, so nothing reaches it. */
const PAY_SITES = /^https:\/\/(paypal|monzo|revolut)\.me\//;
const standIn = { contentType: 'text/html', body: '<title>Pay</title>' };

test('shows what you are owed across the demo groups', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Quits', exact: true })).toBeVisible();
  await expect(page.getByText('¥46,134').first()).toBeVisible();
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
  await page.getByRole('button', { name: 'Chloe pays You ¥25,829' }).click();
  await expect(page.getByLabel('Amount in Japanese yen')).toHaveValue('25829');
  await page.getByLabel('Amount in Japanese yen').fill('10000');
  await expect(page.getByTestId('payment-partial')).toHaveText('Part of the ¥25,829: ¥15,829 will still be owed.');
  await page.getByTestId('payment-note').fill('PayPay');
  await page.getByTestId('save-payment').click();
  await expect(page.getByRole('button', { name: 'Chloe pays You ¥15,829' })).toBeVisible();
  await expect(page.getByLabel(/^Chloe paid you ¥10,000, Today, PayPay$/)).toBeVisible();
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
      '• Aiko pays Ben ¥116,395',
      '• Chloe pays Ben ¥84,466',
      '• Chloe pays me ¥25,829',
      '• Dev pays me ¥20,305',
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
  await expect(page.getByRole('heading', { name: 'Quits', exact: true })).toBeVisible();
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
    await expect(page.getByTestId('spending-summary')).toHaveText('12 expenses over 12 days, about ¥60,111 a day');
    await expect(page.getByLabel('Transport: ¥351,326, 49%, 3 expenses')).toBeVisible();
    await expect(page.getByLabel('Other: ¥1,000, <1%, 1 expense')).toBeVisible();
    await expect(page.getByTestId('busiest')).toHaveText('Busiest day: Thu 27 Aug, ¥271,576');
    await page.getByRole('button', { name: 'Saturday 5 September 2026: ¥135,750 on 2 expenses' }).click();
    await expect(page.getByTestId('busiest')).toHaveText('Sat 5 Sep: ¥135,750');
    await expect(page.getByRole('button', { name: 'Aiko paid ¥29,200 and used ¥145,595' })).toBeVisible();
  });

  test('explains a balance line by line', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await tab(page, 'Balances').click();
    await page.getByRole('button', { name: 'Aiko owes ¥116,395' }).click();
    await expect(page.getByTestId('standing')).toHaveText('Aiko owes ¥116,395');
    await expect(page.getByLabel('Paid for: ¥29,200')).toBeVisible();
    await expect(page.getByLabel('Their share: ¥145,595')).toBeVisible();
    await expect(page.getByTestId('balance')).toHaveText('-¥116,395');
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

test.describe('quick add', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 9, 4, 12));
  });

  test('adds an expense written as a sentence', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await page.getByTestId('quick-add-button').click();
    await page.getByLabel('Describe the expense').fill('Ramen ¥4,800, Aiko paid, split with Ben and me');
    await expect(page.getByTestId('quick-split')).toHaveText('You, Aiko and Ben · ¥1,600 each');
    await page.getByTestId('quick-save').click();
    await expect(page.getByRole('button', { name: /^Ramen, ¥4,800, paid by Aiko, you owe ¥1,600/ })).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: /^Ramen, ¥4,800/ })).toHaveCount(0);
  });

  test('hands what it read to the full form', async ({ page }) => {
    await page.route('**/api.frankfurter.dev/v1/**', (route) => {
      const base = new URL(route.request().url()).searchParams.get('base');
      return route.fulfill({ json: base === 'EUR' ? { date: '2026-10-02', rates: { JPY: 176.99 } } : { date: '2026-10-02', rates: { EUR: 0.00565 } } });
    });
    await openGroup(page, 'Japan trip');
    await page.getByTestId('quick-add-button').click();
    await page.getByLabel('Describe the expense').fill('Museum tickets 30 euros paid by Ben on Friday');
    await expect(page.getByTestId('quick-amount')).toHaveText('€30.00, which is ¥5,310 at €1 = ¥176.99');
    await page.getByTestId('quick-form').click();
    await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
    await expect(page.getByTestId('amount')).toHaveValue('30.00');
    await expect(page.getByRole('button', { name: 'Paid in euros' })).toBeVisible();
    await expect(page.getByTestId('description')).toHaveValue('Museum tickets');
    await expect(page.getByRole('radio', { name: 'Ben' }).first()).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Date: Friday 2 October 2026' })).toBeVisible();
  });

  test('won’t add someone who isn’t in the group', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await page.getByTestId('quick-add-button').click();
    await page.getByLabel('Describe the expense').fill('Dinner with Bob');
    await expect(page.getByTestId('quick-strangers')).toHaveText('Bob isn’t in Japan trip. Add them in group settings first.');
    await expect(page.getByTestId('quick-save')).toBeDisabled();
  });
});

test('splits an itemised bill, with service shared in proportion', async ({ page }) => {
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('description').fill('Curry house');
  await page.getByRole('tab', { name: 'Items' }).click();
  await page.getByTestId('item-label-0').fill('Lamb curry');
  await page.getByTestId('item-amount-0').fill('12.50');
  await page.getByRole('checkbox', { name: 'You had Lamb curry' }).click();
  await page.getByTestId('add-item').click();
  await page.getByTestId('item-label-1').fill('Veg thali');
  await page.getByTestId('item-amount-1').fill('9.50');
  await page.getByRole('checkbox', { name: 'Sam had Veg thali' }).click();
  await page.getByTestId('add-item').click();
  await page.getByTestId('item-label-2').fill('Naans to share');
  await page.getByTestId('item-amount-2').fill('6');
  for (const name of ['You', 'Sam', 'Priya']) await page.getByRole('checkbox', { name: `${name} had Naans to share` }).click();
  await page.getByTestId('item-extras').fill('2.80');
  // £28.00 of food and £2.80 of service: £14.50, £11.50 and £2.00 of food carry £1.45, £1.15 and £0.20.
  await expect(page.getByTestId('amount')).toHaveValue('30.80');
  await page.getByTestId('save-expense').click();
  await expect(page.getByRole('button', { name: /^Curry house, £30\.80, paid by You, you lent £14\.85/ })).toBeVisible();
  await page.getByRole('button', { name: /^Curry house/ }).click();
  await expect(page.getByTestId('item-label-2')).toHaveValue('Naans to share');
});

test('works out a sum typed into the amount', async ({ page }) => {
  await openGroup(page, 'Japan trip');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('4800');
  await page.getByRole('button', { name: 'Type divided by' }).click();
  await page.getByTestId('amount').press('End');
  await page.getByTestId('amount').pressSequentially('3');
  await expect(page.getByTestId('amount-sum')).toHaveText('= ¥1,600');
  await page.getByTestId('description').fill('Karaoke, my third');
  await page.getByTestId('save-expense').click();
  await expect(page.getByRole('button', { name: /^Karaoke, my third, ¥1,600/ })).toBeVisible();
});

test('keeps the groups beside the open group on a wide screen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The sidebar is for wide screens');
  await page.goto('./');
  const sidebar = page.getByRole('navigation', { name: 'Your groups' });
  await expect(sidebar).toBeVisible();
  await page.getByTestId('open-demo').click();
  await expect(page.getByRole('heading', { name: 'Japan trip' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /^Japan trip\./ })).toHaveAttribute('aria-current', 'page');
  // Beside the sidebar there's no back to go to.
  await expect(page.getByRole('button', { name: 'Back to groups' })).toHaveCount(0);
  await sidebar.getByRole('button', { name: /^Flat 4B\./ }).click();
  await expect(page.getByRole('heading', { name: 'Flat 4B' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /^Flat 4B\./ })).toHaveAttribute('aria-current', 'page');
  // Switching groups replaces the one open, so back returns to the start, not to the Japan trip.
  await page.goBack();
  await expect(page.getByTestId('open-demo')).toBeVisible();
});

test.describe('sharing a copy', () => {
  test('a friend opens the link and gets a copy of their own', async ({ page, context, browser }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'share', { value: undefined }));
    await openGroup(page, 'Japan trip');
    await page.getByTestId('share-group').click();
    await page.getByTestId('my-name').fill('Ahmad');
    await page.getByTestId('share-link').click();
    await expect(page.getByText('Link copied, ready to send')).toBeVisible();
    const message = await page.evaluate(() => navigator.clipboard.readText());
    const link = message.match(/https:\S+/)![0];
    expect(link).toMatch(/^https:\/\/ahmadbasraa818\.github\.io\/quits\/import#q1\.[\w-]+$/);
    const fragment = link.split('#')[1];

    // The friend's own browser, with nothing of the sharer's in it.
    const friend = await browser.newContext({ baseURL: test.info().project.use.baseURL, serviceWorkers: 'block' });
    const theirs = await friend.newPage();
    await theirs.goto(`import#${fragment}`);
    await expect(theirs.getByText('Shared by Ahmad')).toBeVisible();
    await expect(theirs.getByTestId('add-copy')).toBeDisabled();
    await theirs.getByTestId('me-aiko').click();
    await theirs.getByTestId('add-copy').click();
    // The same trip, seen from Aiko's side.
    await expect(theirs.getByText('You owe ¥116,395').filter({ visible: true }).first()).toBeVisible();
    await friend.close();

    // Back with the sharer, the same link is an update, not a second copy.
    await page.goto(`import#${fragment}`);
    await expect(page.getByTestId('already-here')).toBeVisible();
    await page.getByTestId('update-copy').click();
    await expect(page.getByRole('heading', { name: 'Japan trip' })).toBeVisible();
  });

  test('says when a link has been cut short', async ({ page }) => {
    await page.goto('import#q1.cut-short');
    await expect(page.getByRole('heading', { name: 'This link doesn’t hold a group' })).toBeVisible();
  });

  test('won’t share under a name someone else has', async ({ page }) => {
    await openGroup(page, 'Japan trip');
    await page.getByTestId('share-group').click();
    await page.getByTestId('my-name').fill('aiko');
    await expect(page.getByTestId('share-problem')).toHaveText('Someone in Japan trip is already called aiko.');
    await expect(page.getByTestId('share-link')).toBeDisabled();
  });
});

test('saves a backup, and restores it', async ({ page }) => {
  await page.goto('about');
  const download = page.waitForEvent('download');
  await page.getByTestId('save-backup').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^quits-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const path = await file.path();

  // Lose a group, then put everything back.
  await openGroup(page, 'Flat 4B');
  await page.getByTestId('group-settings').click();
  await page.getByTestId('delete-group').click();
  await page.getByTestId('confirm').click();
  await expect(page.getByRole('button', { name: /^Flat 4B\./ })).toHaveCount(0);

  await page.goto('about');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('restore-backup').click();
  await (await chooser).setFiles(path);
  await expect(page.getByRole('heading', { name: 'Restore this backup?' })).toBeVisible();
  await page.getByTestId('confirm').click();
  await expect(page.getByText('Restored 3 groups')).toBeVisible();
  await page.goto('./');
  await expect(page.getByRole('button', { name: /^Flat 4B\./ })).toBeVisible();
});

test.describe('looking after saved data', () => {
  // Seeds this browser's storage once, before the app first loads, and not again on a reload. Someone with
  // saved groups has also seen this version's changes, so what's new doesn't cover the page.
  const seed = (page: Page, value: string) =>
    page.addInitScript(
      ([saved, settings]) => {
        if (!sessionStorage.getItem('seeded')) {
          localStorage.setItem('quits', saved);
          localStorage.setItem('quits-settings', settings);
          sessionStorage.setItem('seeded', 'yes');
        }
      },
      [value, JSON.stringify({ state: { welcomeDone: true, seenVersion: app.expo.version }, version: 0 })]
    );

  test('sets aside saved data it can’t read, and keeps it until it’s saved or deleted', async ({ page }) => {
    await seed(page, '{not json');
    // Keeps the text of every file the app offers to save, to read back here.
    await page.addInitScript(() => {
      const saved: string[] = ((window as unknown as { saved: string[] }).saved = []);
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob: Blob | MediaSource) => {
        if (blob instanceof Blob) blob.text().then((text) => saved.push(text));
        return original(blob);
      };
    });
    await page.goto('./');
    await expect(page.getByTestId('notice-set-aside')).toBeVisible();
    // The app opens as if new rather than not at all.
    await expect(page.getByRole('button', { name: /^Japan trip\./ })).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByTestId('save-set-aside').click();
    expect((await download).suggestedFilename()).toMatch(/^quits-unreadable-\d{4}-\d{2}-\d{2}\.json$/);
    // The file's text arrives a moment after the download starts.
    const text = await page.waitForFunction(() => (window as unknown as { saved: string[] }).saved[0]);
    const copy = JSON.parse(await text.jsonValue());
    expect(copy[0].data).toBe('{not json');

    await page.reload();
    await expect(page.getByTestId('notice-set-aside')).toBeVisible();
    await page.getByTestId('delete-set-aside').click();
    await page.getByTestId('confirm').click();
    await expect(page.getByTestId('notice-set-aside')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: /^Japan trip\./ })).toBeVisible();
    await expect(page.getByTestId('notice-set-aside')).toHaveCount(0);
  });

  test('opens every group it can, and sets aside one it can’t', async ({ page }) => {
    const sound = { id: 'g_ok', name: 'Lunch club', currency: 'GBP', members: [{ id: 'you', name: 'You', tone: 0 }, { id: 'm_sam', name: 'Sam', tone: 1 }], me: 'you', expenses: [], payments: [], createdAt: 1 };
    await seed(page, JSON.stringify({ state: { groups: [sound, { ...sound, id: 'g_bad', name: 'Broken trip', expenses: 'not a list' }] }, version: 3 }));
    await page.goto('./');
    await expect(page.getByRole('button', { name: /^Lunch club\./ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Broken trip\./ })).toHaveCount(0);
    await expect(page.getByTestId('notice-set-aside')).toContainText('Broken trip');
  });

  test('says when the browser isn’t saving, and offers a backup', async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      };
    });
    await page.goto('about');
    await page.getByTestId('reset-demo').click();
    await expect(page.getByTestId('notice-not-saving')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByTestId('save-not-saving').click();
    expect((await download).suggestedFilename()).toMatch(/^quits-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test('explains how it handles data, from About and at its own address', async ({ page, request }) => {
  await page.goto('about');
  await expect(page.getByTestId('app-version')).toHaveText(`Quits ${app.expo.version}`);
  await page.getByTestId('open-privacy').click();
  await expect(page.getByRole('heading', { name: 'Your groups stay yours' })).toBeVisible();
  // The address an app store links to answers 200, not GitHub Pages' 404 fallback.
  expect((await request.get('privacy')).status()).toBe(200);
  await page.goto('privacy');
  await expect(page.getByRole('heading', { name: 'Your groups stay yours' })).toBeVisible();
});

test('answers a shared link with a preview, not a 404', async ({ request }) => {
  const response = await request.get('import');
  expect(response.status()).toBe(200);
  const page = await response.text();
  expect(page).toContain('property="og:image" content="https://ahmadbasraa818.github.io/quits/og.png"');
  expect((await request.get('og.png')).status()).toBe(200);
});

test.describe('getting paid', () => {
  /** A weekend where Rui paid for dinner: you and Ana each owe him €30. */
  const lisbon = {
    id: 'g_lisbon',
    name: 'Lisbon weekend',
    currency: 'EUR',
    me: 'you',
    createdAt: 1,
    members: [
      { id: 'you', name: 'You', tone: 0 },
      { id: 'rui', name: 'Rui', tone: 2 },
      { id: 'ana', name: 'Ana', tone: 4 },
    ],
    expenses: [{ id: 'e1', description: 'Dinner', amount: 9000, paidBy: 'rui', split: { kind: 'equal', among: ['you', 'rui', 'ana'] }, category: 'food', date: '2026-10-08', createdAt: 1 }],
    payments: [],
  };

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await context.route(PAY_SITES, (route) => route.fulfill(standIn));
    // No share sheet, so messages are copied, and can be read back here.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'share', { value: undefined }));
  });

  test('pays someone the way they get paid, with the amount filled in', async ({ page }) => {
    await seedGroups(page, [lisbon]);
    await page.goto('group/g_lisbon?tab=settle');
    await page.getByRole('button', { name: 'How does Rui get paid?' }).click();
    // Rui's page, ready to add one.
    await expect(page.getByTestId('pay-sheet')).toBeVisible();
    await page.getByTestId('pay-handle').fill('https://www.paypal.me/RuiCosta/10EUR');
    await expect(page.getByTestId('pay-preview')).toHaveText('Opens paypal.me/RuiCosta. The amount is filled in, in any currency PayPal takes.');
    await page.getByTestId('save-pay').click();
    await expect(page.getByLabel('PayPal: paypal.me/RuiCosta', { exact: true })).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId('settle-headline')).toHaveText('2 payments settle everyone');
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Pay with PayPal' }).click();
    expect((await popup).url()).toBe('https://paypal.me/RuiCosta/30.00EUR');
    await page.getByTestId('pay-you-rui').click();
    await expect(page.getByTestId('settle-headline')).toHaveText('One payment settles everyone');
  });

  test('reminds someone what they owe, with the link to pay you', async ({ page }) => {
    await page.goto('group/demo_japan/member/you');
    await page.getByTestId('add-pay').click();
    await page.getByRole('radio', { name: 'Revolut' }).click();
    await page.getByTestId('pay-handle').fill('@ahmadb');
    await page.getByTestId('save-pay').click();
    await expect(page.getByLabel('Revolut: revolut.me/ahmadb', { exact: true })).toBeVisible();

    await page.goto('group/demo_japan?tab=settle');
    await page.getByTestId('remind-dev-you').click();
    await expect(page.getByText('Reminder copied, ready to paste')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      ['Hi Dev, a quick reminder from Japan trip: you owe me ¥20,305.', '', 'To pay me:', 'Revolut: https://revolut.me/ahmadb', '', 'Thanks!'].join('\n')
    );
    await expect(page.getByTestId('reminded-dev-you')).toHaveText('Reminded today');
    await page.reload();
    await expect(page.getByTestId('reminded-dev-you')).toHaveText('Reminded today');
  });

  test('a friend’s copy pays you the way you get paid', async ({ page, browser }) => {
    await page.goto('group/demo_japan/member/you?pay=add');
    await page.getByTestId('pay-handle').fill('ahmadb');
    await page.getByTestId('save-pay').click();
    await expect(page.getByLabel('PayPal: paypal.me/ahmadb', { exact: true })).toBeVisible();
    await page.goto('group/demo_japan');
    await page.getByTestId('share-group').click();
    await page.getByTestId('my-name').fill('Ahmad');
    await page.getByTestId('share-link').click();
    await expect(page.getByText('Link copied, ready to send')).toBeVisible();
    const fragment = (await page.evaluate(() => navigator.clipboard.readText())).match(/#(\S+)/)![1];

    // Dev opens the link in their own browser, and pays from their copy.
    const friend = await browser.newContext({ baseURL: test.info().project.use.baseURL, serviceWorkers: 'block' });
    await friend.route(PAY_SITES, (route) => route.fulfill(standIn));
    const theirs = await friend.newPage();
    await theirs.goto(`import#${fragment}`);
    await theirs.getByTestId('me-dev').click();
    await theirs.getByTestId('add-copy').click();
    await tab(theirs, 'Settle up').click();
    await expect(theirs.getByRole('button', { name: 'You pay Ahmad ¥20,305' })).toBeVisible();
    const popup = theirs.waitForEvent('popup');
    await theirs.getByRole('button', { name: 'Pay with PayPal' }).click();
    expect((await popup).url()).toBe('https://paypal.me/ahmadb/20305JPY');
    await friend.close();
  });
});

test.describe('help', () => {
  test('answers a question, and shows where to do it', async ({ page, request }) => {
    // A support link to the help answers 200, not GitHub Pages' 404 fallback.
    expect((await request.get('help')).status()).toBe(200);
    await page.goto('./');
    await page.getByTestId('open-help').click();
    await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible();
    await page.getByTestId('help-search').fill('item by item');
    await page.getByText('How do I split a bill item by item?').click();
    await expect(page.getByText(/choose Items under Split/)).toBeVisible();
    await page.getByTestId('show-items').click();
    await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
    await expect(tab(page, 'Items')).toHaveAttribute('aria-selected', 'true');
  });

  test('opens the answer from a “?” beside the thing it explains', async ({ page }) => {
    await page.goto('group/demo_japan?tab=settle');
    await expect(page.getByTestId('settle-headline')).toHaveText('4 payments settle everyone');
    await page.getByTestId('help-fewest').click();
    await expect(page.getByTestId('asked')).toContainText('How does Quits find the fewest payments?');
  });

  test('welcomes someone new, until they put it away', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'phone', 'On a wide screen the welcome sits beside the groups instead');
    await page.goto('./');
    await expect(page.getByTestId('welcome-card')).toBeVisible();
    await page.getByTestId('welcome-dismiss').click();
    await expect(page.getByTestId('welcome-card')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: /^Japan trip\./ })).toBeVisible();
    await expect(page.getByTestId('welcome-card')).toHaveCount(0);
  });

  test('tells someone back after an update what’s new, once', async ({ page }) => {
    // A save from before this version kept track of what's been seen: groups, and no settings.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('quits', JSON.stringify({ state: { groups: [] }, version: 3 }));
        sessionStorage.setItem('seeded', 'yes');
      }
    });
    await page.goto('./');
    await expect(page.getByTestId('whats-new')).toBeVisible();
    await expect(page.getByText('Help when you need it')).toBeVisible();
    await page.getByTestId('whats-new-done').click();
    await expect(page.getByTestId('whats-new')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('new-group').first()).toBeVisible();
    await expect(page.getByTestId('whats-new')).toHaveCount(0);
  });

  test('is a click away beside an open group on a wide screen', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'The sidebar is for wide screens');
    await page.goto('group/demo_japan');
    await page.getByTestId('open-help-sidebar').click();
    await expect(page.getByRole('heading', { name: 'Questions and answers' })).toBeVisible();
  });

  test('works from the keyboard on a computer', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Shortcuts are for a keyboard');
    await page.goto('group/demo_japan');
    await expect(page.getByRole('heading', { name: 'Japan trip' })).toBeVisible();
    await page.keyboard.press('/');
    await expect(page.getByTestId('search-expenses')).toBeFocused();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('q');
    await expect(page.getByTestId('quick-add')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('quick-add')).toBeHidden();
    await page.keyboard.press('n');
    await expect(page.getByRole('heading', { name: 'Add expense' })).toBeVisible();
    await page.goto('./');
    await page.keyboard.press('?');
    await expect(page.getByRole('heading', { name: 'Help', exact: true })).toBeVisible();
  });
});

test('resets or removes the demo groups, keeping your own', async ({ page }) => {
  await page.goto('new-group');
  await page.getByTestId('group-name').fill('Lisbon weekend');
  await page.getByTestId('person-0').fill('Rui');
  await page.getByTestId('create-group').click();
  await expect(page.getByRole('heading', { name: 'Lisbon weekend' })).toBeVisible();

  await page.goto('about');
  await page.getByTestId('reset-demo').click();
  await expect(page.getByRole('button', { name: /^Lisbon weekend\./ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Japan trip\./ })).toBeVisible();

  await page.goto('about');
  await page.getByTestId('remove-demo').click();
  await expect(page.getByRole('button', { name: /^Japan trip\./ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Lisbon weekend\./ })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Japan trip\./ })).toBeVisible();
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('opens without a connection once it has been opened', async ({ page, context }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Quits', exact: true }).first()).toBeVisible();
    // The worker keeps every file before it takes over.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(async () => (await caches.keys()).some((key) => key.startsWith('quits-')));
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Quits', exact: true }).first()).toBeVisible();
    await page.goto('group/demo_flat');
    await expect(page.getByRole('heading', { name: 'Flat 4B' })).toBeVisible();
  });
});

test('opens a deep link straight to a group', async ({ page }) => {
  await page.goto('group/demo_flat');
  await expect(page.getByRole('heading', { name: 'Flat 4B' })).toBeVisible();
});

test.describe('accessibility', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations on the main screens in ${scheme} mode`, async ({ page }) => {
      // Twenty-one scans take longer on CI than the default limit allows.
      test.slow();
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
      await page.goto('group/demo_japan');
      await page.getByTestId('share-group').click();
      await scan('share a copy');
      await page.keyboard.press('Escape');
      await page.goto('import#q1.cut-short');
      await scan('a broken link');
      await page.goto('privacy');
      await scan('privacy');
      await page.goto('help');
      await scan('help');
      await page.goto('help?entry=fewest');
      await scan('an answer');
      await page.goto('about');
      await page.getByTestId('open-changes').click();
      await scan('what’s new');
      await page.keyboard.press('Escape');
      await page.goto('group/demo_japan');
      await page.getByTestId('quick-add-button').click();
      await page.getByLabel('Describe the expense').fill('Ramen ¥4,800, Aiko paid, split with Ben and me');
      await scan('quick add');
      await page.goto('group/demo_japan/spending');
      await scan('spending');
      await page.goto('group/demo_japan/member/aiko');
      await scan('statement');
      await page.goto('group/demo_japan/member/you?pay=add');
      await page.getByTestId('pay-handle').fill('ahmadb');
      await scan('add how you get paid');
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
