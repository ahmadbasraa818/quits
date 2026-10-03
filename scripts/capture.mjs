// Captures the README's screenshots and demo from the web export.
// Run after `npm run export:web`, with the export served: node scripts/serve-dist.mjs 4173
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'http://localhost:4173/quits/';
const OUT = 'docs';
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ ...phone, colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, `${scheme}-groups.png`) });
  await page.getByRole('button', { name: /^Japan trip\./ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('tab', { name: 'Settle up' }).click();
  await page.waitForTimeout(700);
  await page.mouse.wheel(0, 520);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${scheme}-settle.png`) });
  await page.mouse.wheel(0, -2000);
  await page.getByRole('tab', { name: 'Balances' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, `${scheme}-balances.png`) });
  await page.getByRole('tab', { name: 'Expenses' }).click();
  await page.getByTestId('add-expense').click();
  await page.getByTestId('amount').fill('4800');
  await page.getByTestId('description').fill('Karaoke');
  await page.getByRole('radio', { name: 'Fun' }).click();
  await page.getByTestId('payer-aiko').click();
  await page.getByRole('checkbox', { name: 'Split with Ben' }).click();
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `${scheme}-add.png`) });
  await page.close();
}

// A short demo: open the trip, compare the plans, settle up.
rmSync(join(OUT, 'video'), { recursive: true, force: true });
const context = await browser.newContext({ ...phone, deviceScaleFactor: 1, colorScheme: 'light', recordVideo: { dir: join(OUT, 'video'), size: { width: 390, height: 844 } } });
const page = await context.newPage();
await page.goto(BASE);
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /^Japan trip\./ }).click();
await page.waitForTimeout(1300);
await page.getByRole('tab', { name: 'Balances' }).click();
await page.waitForTimeout(1700);
await page.getByRole('tab', { name: 'Settle up' }).click();
await page.waitForTimeout(1200);
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
console.log('Captured screenshots and docs/demo.webm');
