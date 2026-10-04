<p align="center">
  <img src="assets/images/logo.png" width="88" alt="">
</p>

<h1 align="center">Quits</h1>

<p align="center">
  <strong>Split costs with friends. Settle up in the fewest payments.</strong><br>
  A React Native app for iOS, Android and the web.
</p>

<p align="center">
  <a href="https://ahmadbasraa818.github.io/quits/"><strong>Try the live demo</strong></a>
  ·
  <a href="#the-fewest-payments">How it settles up</a>
  ·
  <a href="#how-its-built">How it’s built</a>
</p>

<p align="center">
  <a href="https://github.com/ahmadbasraa818/quits/actions/workflows/ci.yml"><img src="https://github.com/ahmadbasraa818/quits/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/Expo-SDK%2057-16171A" alt="Expo SDK 57">
  <img src="https://img.shields.io/badge/TypeScript-strict-16171A" alt="TypeScript, strict">
  <img src="https://img.shields.io/badge/license-MIT-16171A" alt="MIT licence">
</p>

![Quits: the groups list, the settle-up plan for a trip, and adding an expense in dark mode](docs/hero.png)

## What it does

- **Groups** for a trip, a flat or a night out, in any of 33 currencies. Rename them, add people, mark who has left, or delete a group and undo it.
- **Pay in one currency, settle in another:** each expense can be in its own currency, converted at the European Central Bank’s rate for its date or at a rate you type, fixed when you save it.
- **Every expense dated and noted:** pick the day from a calendar and add a note, then change anything later.
- **Split any way:** equally, by shares, or by exact amounts. Every split adds up to the penny.
- **See where everyone stands:** each balance is a bar either side of zero.
- **Settle up in the fewest payments.** The demo’s five-person Japan trip settles in 4 payments instead of the 10 it would take pair by pair. Switch between the two and the arrows redraw, so you watch the saving happen, and Quits says why the plan can’t be any shorter.
- **Record payments as they happen:** a whole payment with a tap, part of one, or one made outside the plan, with a history you can undo. Share the plan with the group as a message.
- **Undo** for deleted expenses and recorded payments, light and dark themes, and screen-reader labels throughout.

<p align="center">
  <img src="docs/demo.gif" width="300" alt="Opening the Japan trip, comparing the plan with paying pair by pair, and recording each payment until everyone is square">
</p>

## The fewest payments

After a trip, the obvious way to square up is pair by pair: everyone pays back each person who paid for them. That can take far more transfers than needed. Finding the true minimum is NP-hard in general, so most apps settle for a greedy match. Quits finds the exact answer for any realistic group.

The insight: if the people who are owed or owe can be split into *k* circles whose balances each add up to zero, they can settle in *n − k* payments, and never in fewer. So the job is to find the most zero-sum circles. [`src/lib/settle.ts`](src/lib/settle.ts) does that with a dynamic program over every subset of people:

- `groups[mask]` is the most zero-sum circles among the people in `mask`, taken in some order. It is the best over each person `i` of `groups[mask without i]`, plus one if `mask` itself sums to zero.
- Walking back from the full set recovers an order in which the running total returns to zero at the end of each circle. Each circle then settles in one payment fewer than its size.
- That is O(2ⁿ · n): instant for up to 16 people with an open balance. Larger groups fall back to matching the largest debtor with the largest creditor.
- The circles it finds are reported along with the payments, so the app can explain the count: “Their balances cancel out in 2 separate circles: Aiko and Ben; Chloe, Dev and you.”

It is checked, not just argued. Property tests (fast-check) generate hundreds of random groups with every kind of split and confirm, for each one, that the payments clear every balance, use no more than greedy matching, and match an independent backtracking search for the true minimum. One fixed case shows the difference: greedy needs 4 payments where Quits needs 3.

## Fair to the penny

- Money is held as whole minor units (pence, cents, yen), so totals never pick up floating-point error.
- When a bill won’t divide evenly, the leftover units go to the largest fractional parts, using the largest remainder method. £10 between three people is £3.34, £3.33 and £3.33, never £9.99 or £10.01. Property tests confirm that every split adds up exactly and that no one is ever more than a unit from their fair share.
- Amounts are parsed from what people type without ever going through floating point, and each currency keeps its own number of decimals: yen has none. The decimal comma works too, so “12,50” is twelve fifty and “1,250” is one thousand two hundred and fifty.

## Exact currency conversion

The demo trip keeps its books in yen, but the JR Passes were bought at home: £1,310.00 at £1 = ¥207.31.

- Rates are stored as decimal strings, exactly as the ECB publishes them or as you typed them, never as floats. Each is kept the way round that reads above one, so it's "£1 = ¥207.31", not "¥1 = £0.0048237".
- [`convert`](src/lib/fx.ts) multiplies whole numbers in BigInt and rounds once, half up. £1,310.00 × 207.31 is exactly ¥271,576.10, so ¥271,576.
- The split is worked out in the currency that was paid. The converted total is then divided in the same proportions with the largest remainder method, so the shares add up to the yen exactly. That proportional division can multiply two large amounts past 2^53, so `allocate` switches to BigInt there. A property test found that case.
- Rates come from the ECB through [Frankfurter](https://frankfurter.dev): free, keyless, and open to any website. On a weekend the reply carries Friday's rate and says so. Without a connection, or for the three currencies the ECB doesn't cover, you type the rate, and Quits reads it back ("£1 = ₫33,000") so a thousands comma can't quietly become a decimal point. Looked-up rates are kept, since a past day's rate never changes.
- Version 2 of the saved data added the JR Passes to the demo. [A migration](src/store/migrations.ts) gives returning visitors the new demo only if they never changed theirs.

## How it’s built

| | |
|---|---|
| App | Expo SDK 57, React Native 0.86 and React 19, with the React Compiler; one codebase for iOS, Android and the web |
| Navigation | Expo Router with typed routes; modal screens for adding and editing |
| State | Zustand, persisted with AsyncStorage. On the web it falls back to memory if the browser blocks storage, so the demo still works when embedded in another site. |
| Motion | Reanimated 4: sliding tab marker, animated balance bars, list layout transitions and press feedback, all off when the system asks for reduced motion |
| Gestures | React Native Gesture Handler: swipe an expense to delete it |
| Graphics | react-native-svg for the settle-up diagram, and a generated subset of Phosphor icons (36 of them, not the whole set) |
| Type | Archivo, loaded per weight |

```
src/
  app/          screens (Expo Router): groups, a group, add or edit an expense, new group, about
  components/   buttons, chips, segmented control, avatars, balance bars, settle-up diagram, toasts
  lib/          the logic, with no React in it: money, splits, balances, settling up
  store/        the persisted store, the per-group summary and the demo data
  theme/        colours for light and dark, type and spacing
e2e/            Playwright tests against the web build
scripts/        icons, web export, screenshots
```

## Quality

- **171 unit, property and component tests** with Jest, React Native Testing Library and fast-check, covering the logic, the store and the components.
- **46 end-to-end runs** with Playwright, on a phone-sized and a desktop browser, against the real web build served as GitHub Pages serves it. They add, edit, delete and undo; settle a whole group, watching the graph redraw; record part of a payment and delete one; share the plan through the clipboard; create, edit and delete groups; date an expense; pay in euros at a served ECB rate, in đồng at a typed rate, and without a connection; follow a deep link; and run axe accessibility scans of eleven screens and sheets in light and dark mode.
- **CI on every push:** lint, strict TypeScript, tests, the web build and the end-to-end tests. Pushes to `main` deploy the live demo.

## Run it

```bash
npm install
npm start                 # then press w for the web, i for the iOS simulator, a for Android
npm test                  # unit, property and component tests
npm run export:web        # the web build, in dist/
npm run e2e               # end-to-end tests against that build
```

## Licence

MIT
