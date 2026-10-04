# How Quits is built

This is a tour of the code and the decisions behind it. The [README](../README.md) covers what the app does and the maths in detail.

## Layers

```
src/app          screens, one file per route (Expo Router)
src/components   the pieces the screens are made of
src/store        state: the persisted store, migrations, backups, summaries
src/lib          logic: plain TypeScript functions on plain data
```

Each layer uses the ones below it and never the ones above. `src/lib` has no React in it, no storage and nothing platform-specific, so everything that has to be right can be tested as plain functions:

- **Money:** parsing, formatting, and 33 currencies (`money.ts`).
- **Splitting and balances:** splits and the largest remainder method (`split.ts`), balances (`balances.ts`), settling up (`settle.ts`).
- **Currencies:** conversion (`fx.ts`) and ECB rates (`rates.ts`).
- **Reading what people type:** sums (`calc.ts`) and sentences (`quick-add.ts`).
- **Sharing:** share links (`share-link.ts`) and checking anything from outside (`validate.ts`).
- **Reports:** statements and spending (`insights.ts`), and the text of a shared plan (`plan-text.ts`).
- **The settle-up diagram:** its layout (`graph-layout.ts`).

The screens stay thin. They read from the store, call its actions, and arrange components.

## The data

A group holds its people, its expenses and its payments, the currency it keeps its books in, and which person is "you" on this device.

- **Amounts are integers** in the smallest unit of the group's currency: pence, cents or yen.
  - An expense paid in another currency also keeps what was paid, in which currency, and at what rate.
  - The rate is a decimal string, kept the way round that reads above one, like "£1 = ¥207.31".
- **A split** is one of four kinds:
  - equally among some of the people;
  - by shares;
  - by exact amounts;
  - item by item, with tax, service and tip on top.
  - `sharesOf` turns any of them into each person's share, and the shares always add up to the amount.
- **Balances are never stored.** `summarise` works them out from the expenses and payments whenever a group changes, along with the plan to settle up. They can't drift out of step with the history.

## State and saving

- **One store:** a Zustand store, `useGroups`, holds every group.
  - Its actions are the only way to change one: add, edit or delete an expense, record a payment, import a copy, restore a backup, and so on.
  - Deleting returns what was deleted, so a toast can offer to put it back.
- **Saving:** the store is saved with `safeStorage`. That's AsyncStorage on a phone and localStorage on the web. Some browsers block storage for a page embedded in another site, and then it falls back to memory, so the demo still works on the portfolio site that embeds it.
- **Versions:** saved data carries a version number, and `migrate` brings older data up to date.
  - The demo data has versions too. A returning visitor gets the newer demo only if they never changed their copy.
  - Backups go through the same migrations.
- **Data from outside** goes through `validateGroup` before it's saved: a share link, or a backup file. It checks every field's type and range, that splits and payments only name people in the group, and that "you" is one of them.

## Decisions

### No server

Groups live on the device. That keeps people's spending private, costs nothing to run, and lets the demo work anywhere, including offline. What a server would usually do is done another way:

- **Sharing:** a group travels inside a link, compressed, after the `#`. Browsers never send that part of a link to a server.
- **Moving devices:** a backup file.
- **Exchange rates:** fetched straight from the ECB's data through Frankfurter, which is free, needs no key, and is open to any website. Only a currency pair and a date are sent.

The cost is that copies don't stay in step on their own. The app says so where you share, and opening a newer link updates a copy rather than adding another.

### Integers for money, BigInt where they could overflow

Floating point can't represent 0.1, so amounts are whole numbers of the smallest unit.

- **Dividing:** splits use the largest remainder method. The pennies that don't divide evenly go to the people with the largest fractions, so every split adds up exactly.
- **Big products:** two steps multiply large amounts, and the products can pass 2^53, where JavaScript numbers stop being exact. Those are converting a currency, and dividing a converted total in proportion. Both use BigInt there. A property test found the second case.

### Exact settling up, with its working shown

Greedy matching usually finds a short plan, but not always the shortest. Quits looks for the most groups of people whose balances cancel out, by a dynamic program over every subset of people, and that is provably optimal.

- **Size:** it's exact for up to 16 people with an open balance. Larger groups fall back to the greedy match.
- **Explaining the count:** the groups it finds come back with the payments, so the app can say why the plan can't be shorter.

### A scanner for quick add, not a model

Quick add reads a sentence with a small hand-written scanner. It's instant, works offline, costs nothing, and can be tested case by case. A table of sentences and a property test cover it.

It doesn't guess. Anything the sentence doesn't say falls back to the form's defaults, and the preview marks it "assumed". A name it doesn't recognise is reported, not matched to the nearest person.

### Formatting by hand

- **Dates:** `Intl` formats them differently on iOS, on Android and in each browser, so dates are formatted by the app's own code and look the same everywhere.
- **Money:** amounts are formatted with `Intl` for the digits, but the currency symbols are the app's own. iOS's `Intl` ignores the narrow symbol option and writes "JP¥" and "US$".

### Accessibility on the web

React Native for Web 0.21 drops `accessibilityState`. So tabs, radio buttons and checkboxes set `aria-selected` and `aria-checked` directly, which work on every platform.

The end-to-end tests run axe on sixteen screens and sheets in both themes, with reduced motion on, so a frame of an animation is never read as a contrast failure.

### The web app

`scripts/postexport.mjs` writes the service worker into the web build.

- **What it keeps:** every file of the current version. Its version is a hash of their contents, so a deploy that changes nothing installs nothing new.
- **Pages:** these come from the network first, so a new deploy shows at once, and from the kept copy when offline.
- **When it registers:** only in a production build, and not inside an iframe. The portfolio site that embeds the demo doesn't get a worker it never asked for.

### Platform differences in one place

Where the web and phones differ, there are two files side by side. For example, `backup-file.ts` saves a backup through the share sheet with expo-file-system and expo-sharing, and `backup-file.web.ts` downloads it. The bundler picks the right one, and the code that calls them never checks the platform.

### The settle-up diagram's labels

Each payment's amount sits beside its arrow. `placeLabels` tries spots on both sides of the arrow, at several points along it and at a few distances from it. Each spot gets a cost for what it would cover:

- the edge of the drawing, which costs most;
- the people;
- their names;
- the amounts already placed;
- the other arrows.

The cheapest spot wins. When costs tie, it prefers the middle of the arrow and the outside of the circle, because the arrows that cross the circle need the inside.

## Testing

- **Logic and store:** Jest tests cover the logic and the store, and fast-check property tests try hundreds of random groups against the claims that matter. These are some of them:
  - every split adds up exactly;
  - every settlement clears every balance in the fewest payments, checked against an independent search;
  - share links carry any group there and back;
  - a label never covers its own arrow.
- **Components:** these are tested with React Native Testing Library.
- **End to end:** Playwright runs against the real web build, served the way GitHub Pages serves it, in a phone-sized and a desktop browser.
  - It covers whole journeys, like sharing a group to a second, empty browser and opening it as another person.
  - It covers the offline service worker, and served and failed rate lookups.
- **On a phone:** the native paths have been run in Expo Go on the iOS simulator: share links opened as deep links, a backup saved through the share sheet and read back.

## Building and shipping

- **On every push**, CI runs two jobs:
  - lint, strict TypeScript and the Jest tests;
  - the web build and the Playwright tests.
- **On `main`**, a third job deploys the build to GitHub Pages, but only after both of those pass.
- **Screenshots:** the ones in the README come from the same build, through `scripts/capture.mjs`.
