// Captures the README's screenshots and demo from the web export.
// Run after `npm run export:web`, with the export served: node scripts/serve-dist.mjs 4173
// The demo is converted to docs/demo.gif when ffmpeg is installed.
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:4173/quits/';
const OUT = 'docs';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const noWebShare = () => Object.defineProperty(Navigator.prototype, 'share', { value: undefined });
// Someone who has used Quits before: no welcome card, and this version's notes already seen.
const { version } = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const regular = (seen) => localStorage.setItem('quits-settings', JSON.stringify({ state: { welcomeDone: true, seenVersion: seen }, version: 0 }));
// A weekend where Rui paid for dinner, with his PayPal and Monzo, and Ana reminded yesterday.
const lisbon = {
  id: 'g_lisbon',
  name: 'Lisbon weekend',
  currency: 'EUR',
  me: 'you',
  createdAt: 1,
  members: [
    { id: 'you', name: 'You', tone: 0 },
    { id: 'rui', name: 'Rui', tone: 2, pay: [{ kind: 'paypal', handle: 'ruicosta' }, { kind: 'monzo', handle: 'rui' }] },
    { id: 'ana', name: 'Ana', tone: 4 },
  ],
  expenses: [{ id: 'e1', description: 'Dinner at Taberna', amount: 9000, paidBy: 'rui', split: { kind: 'equal', among: ['you', 'rui', 'ana'] }, category: 'food', date: '2026-10-08', createdAt: 1 }],
  payments: [],
};
const seedLisbon = ([group, seen]) => {
  localStorage.setItem('quits', JSON.stringify({ state: { groups: [group] }, version: 4 }));
  localStorage.setItem('quits-settings', JSON.stringify({ state: { welcomeDone: true, seenVersion: seen, haptics: true, reminded: { 'g_lisbon/ana/rui': Date.now() - 86_400_000 } }, version: 0 }));
};
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ ...phone, baseURL: BASE, colorScheme: scheme, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript(noWebShare);
  await context.addInitScript(regular, version);
  const page = await context.newPage();
  const shot = async (name) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, `${scheme}-${name}.png`) });
  };
  // Wheel scrolls go to whatever is under the pointer, so keep it over the content.
  const scroll = async (by) => {
    await page.mouse.move(195, 500);
    await page.mouse.wheel(0, by);
  };

  await page.goto(BASE);
  await shot('groups');

  await page.getByRole('button', { name: /^Japan trip\./ }).click();
  await page.getByRole('tab', { name: 'Settle up' }).click();
  await page.waitForTimeout(500);
  // From the line under the heading: the graph, then the plan's payments with their reminders.
  await scroll((await page.getByText(/^Paying back pair by pair/).boundingBox()).y - 58);
  await shot('settle');
  await scroll(-2000);
  await page.getByRole('tab', { name: 'Balances' }).click();
  await shot('balances');

  await page.goto('group/demo_japan/member/aiko');
  await shot('statement');
  await page.goto('group/demo_japan/spending');
  await shot('spending');

  await page.goto('group/demo_japan');
  await page.getByTestId('quick-add-button').click();
  await page.getByTestId('quick-text').fill('Karaoke ¥12,000, Aiko paid, for everyone');
  await shot('quick');

  await page.goto('group/demo_japan/expense?expenseId=japan_e11');
  await page.getByTestId('item-0').waitFor();
  await page.getByTestId('item-0').evaluate((item) => item.scrollIntoView({ block: 'start' }));
  await scroll(-150);
  await shot('items');

  await page.goto('group/demo_japan');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('4800');
  await page.getByTestId('description').fill('Karaoke');
  await page.getByRole('radio', { name: 'Fun' }).click();
  await page.getByTestId('payer-aiko').click();
  await page.getByRole('checkbox', { name: 'Split with Ben' }).click();
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await scroll(-2000);
  await shot('add');

  // Share the trip, then open the link in a second browser as one of the friends.
  await page.goto('group/demo_japan');
  await page.getByTestId('share-group').click();
  await page.getByTestId('my-name').fill('Ahmad');
  await shot('share');
  await page.getByTestId('share-link').click();
  await page.getByText('Link copied, ready to send').waitFor();
  const link = (await page.evaluate(() => navigator.clipboard.readText())).match(/https:\S+/)[0];
  const friend = await browser.newContext({ ...phone, colorScheme: scheme, reducedMotion: 'reduce' });
  const theirs = await friend.newPage();
  await theirs.goto(`${BASE}import#${link.split('#')[1]}`);
  await theirs.getByTestId('me-aiko').click();
  await theirs.waitForTimeout(600);
  await theirs.screenshot({ path: join(OUT, `${scheme}-import.png`) });
  await friend.close();

  // A monthly bill in the flat.
  await page.goto('group/demo_flat');
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('1200');
  await page.getByTestId('description').fill('Rent');
  await page.getByRole('radio', { name: 'Home' }).click();
  await page.getByRole('tab', { name: 'Monthly' }).click();
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  // From who paid down to the note: the split, and how often it repeats.
  await page.getByText('Paid by', { exact: true }).evaluate((label) => label.scrollIntoView({ block: 'start' }));
  await scroll(-12);
  await shot('repeat');

  // Help, opened at the answer about getting paid.
  await page.goto('help?entry=pay-links');
  await shot('help');
  await context.close();

  // Paying Rui through the ways he gets paid, and Ana reminded.
  const weekend = await browser.newContext({ ...phone, baseURL: BASE, colorScheme: scheme, reducedMotion: 'reduce' });
  await weekend.addInitScript(seedLisbon, [lisbon, version]);
  const pay = await weekend.newPage();
  await pay.goto('group/g_lisbon?tab=settle');
  await pay.getByTestId('pay-with-paypal').waitFor();
  await pay.getByTestId('transfer-ana-rui').evaluate((row) => row.scrollIntoView({ block: 'start' }));
  await pay.mouse.move(195, 500);
  await pay.mouse.wheel(0, -24);
  await pay.waitForTimeout(600);
  await pay.screenshot({ path: join(OUT, `${scheme}-pay.png`) });
  await weekend.close();

  // A wide window: the groups stay in a sidebar beside the open one.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, colorScheme: scheme, reducedMotion: 'reduce' });
  await desktop.goto(`${BASE}group/demo_japan`);
  await desktop.getByRole('tab', { name: 'Settle up' }).click();
  await desktop.waitForTimeout(800);
  await desktop.screenshot({ path: join(OUT, `${scheme}-desktop.png`) });
  await desktop.close();
}

// The demo: add an expense by typing it, then settle the trip.
rmSync(join(OUT, 'video'), { recursive: true, force: true });
const context = await browser.newContext({ ...phone, deviceScaleFactor: 1, colorScheme: 'light', recordVideo: { dir: join(OUT, 'video'), size: { width: 390, height: 844 } } });
await context.addInitScript(regular, version);
const page = await context.newPage();
await page.goto(BASE);
await page.waitForTimeout(1400);
await page.getByRole('button', { name: /^Japan trip\./ }).click();
await page.waitForTimeout(1200);
await page.getByTestId('quick-add-button').click();
await page.waitForTimeout(700);
await page.getByTestId('quick-text').pressSequentially('Karaoke ¥12,000, Aiko paid, for everyone', { delay: 45 });
await page.waitForTimeout(1500);
await page.getByTestId('quick-save').click();
await page.waitForTimeout(1300);
await page.getByRole('tab', { name: 'Settle up' }).click();
await page.waitForTimeout(1000);
await page.mouse.wheel(0, 380);
await page.waitForTimeout(900);
await page.getByRole('tab', { name: /^Pair by pair/ }).click();
await page.waitForTimeout(1600);
await page.getByRole('tab', { name: /^Quits plan/ }).click();
await page.waitForTimeout(1400);
for (let i = 0; i < 4; i += 1) {
  await page.getByRole('button', { name: 'Mark paid' }).first().click();
  await page.waitForTimeout(650);
}
await page.waitForTimeout(1500);
await context.close();
const [video] = readdirSync(join(OUT, 'video'));
renameSync(join(OUT, 'video', video), join(OUT, 'demo.webm'));
rmSync(join(OUT, 'video'), { recursive: true, force: true });
await browser.close();

try {
  const palette = 'fps=12,scale=320:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle';
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(OUT, 'demo.webm'), '-vf', palette, join(OUT, 'demo.gif')]);
  rmSync(join(OUT, 'demo.webm'));
  console.log('Captured the screenshots and docs/demo.gif');
} catch {
  console.log('Captured the screenshots and docs/demo.webm (install ffmpeg to make docs/demo.gif)');
}
