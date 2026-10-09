import type { Href } from 'expo-router';

import { fold } from './text';
import type { Group } from './types';

/** Where a help answer's "Show me" goes: a screen, or a screen of a group. */
export type HelpTarget =
  | { kind: 'route'; href: '/new-group' | '/about' | '/privacy' }
  | { kind: 'group'; screen: 'expense' | 'items' | 'quick' | 'balances' | 'settle' | 'share' | 'spending' | 'statement' };

export const TOPICS = [
  { id: 'start', title: 'Getting started' },
  { id: 'adding', title: 'Adding expenses' },
  { id: 'settling', title: 'Settling up' },
  { id: 'sharing', title: 'Sharing and backups' },
  { id: 'data', title: 'Your data' },
] as const;

export type TopicId = (typeof TOPICS)[number]['id'];

export type HelpEntry = {
  readonly id: string;
  readonly topic: TopicId;
  readonly question: string;
  /** Paragraphs. */
  readonly answer: readonly string[];
  /** Other words someone might search for. */
  readonly keywords: readonly string[];
  readonly show?: { readonly label: string; readonly target: HelpTarget };
};

const ENTRIES = [
  {
    id: 'start-group',
    topic: 'start',
    question: 'How do I start a group?',
    answer: [
      'Tap New group, give it a name and a currency, and add everyone who’s sharing costs. You’re in every group as “You”.',
      'You can rename the group, add people and mark who has left in its settings later.',
    ],
    keywords: ['new', 'create', 'trip', 'flat', 'friends', 'people'],
    show: { label: 'Start a group', target: { kind: 'route', href: '/new-group' } },
  },
  {
    id: 'demo',
    topic: 'start',
    question: 'What are the groups that are already here?',
    answer: [
      'A demo, so there’s something to try: a trip to Japan, a shared flat and a day at the seaside. Change them as much as you like.',
      'In About, Reset the demo groups puts them back as they were, keeping your own groups, and Remove the demo groups clears them away when you’re ready.',
    ],
    keywords: ['sample', 'example', 'japan', 'reset', 'delete', 'remove'],
    show: { label: 'Open About', target: { kind: 'route', href: '/about' } },
  },
  {
    id: 'you',
    topic: 'start',
    question: 'Who is “You”?',
    answer: [
      'The person using this device. Amounts are shown from your side: what you’re owed, and what you owe.',
      'When you share a group you give your name, so your friends know which person you are.',
    ],
    keywords: ['me', 'myself', 'name', 'owner'],
  },
  {
    id: 'offline',
    topic: 'start',
    question: 'Does Quits work offline?',
    answer: [
      'Yes. Everything works without a connection except looking up an exchange rate, and you can type a rate instead.',
      'On the web, install Quits from your browser and it opens like an app, offline too.',
    ],
    keywords: ['internet', 'connection', 'install', 'app', 'pwa', 'home screen'],
    show: { label: 'Open About', target: { kind: 'route', href: '/about' } },
  },
  {
    id: 'add-expense',
    topic: 'adding',
    question: 'How do I add an expense?',
    answer: [
      'Open a group and tap Add expense. Enter the amount, what it was for and who paid, then choose who shared it.',
      'Tap an expense later to change it, or swipe it left to delete it. A message at the bottom lets you undo.',
    ],
    keywords: ['new', 'cost', 'bill', 'edit', 'change', 'delete', 'remove', 'undo'],
    show: { label: 'Add an expense', target: { kind: 'group', screen: 'expense' } },
  },
  {
    id: 'quick-add',
    topic: 'adding',
    question: 'Can I add an expense by typing a sentence?',
    answer: [
      'Yes. Tap the wand beside Add expense and write it as you’d say it, like “Ramen ¥4,800, Aiko paid, split with Ben and me”.',
      'Quits shows what it understood as you type, and marks anything it assumed. It reads amounts and currencies, who paid, who shared, and dates such as “yesterday” or “5 Sep”.',
    ],
    keywords: ['quick', 'wand', 'sentence', 'type', 'natural', 'fast'],
    show: { label: 'Try quick add', target: { kind: 'group', screen: 'quick' } },
  },
  {
    id: 'split',
    topic: 'adding',
    question: 'How can I split a bill?',
    answer: [
      'Four ways. Equally, between the people you choose. By shares, when someone should pay double. By exact amounts, which must add up to the total. Or item by item, for a restaurant bill.',
      'However you split it, the parts add up to the penny: when a bill won’t divide evenly, the odd pennies go where they’re fairest.',
    ],
    keywords: ['split', 'equal', 'shares', 'exact', 'unequal', 'divide', 'percent'],
    show: { label: 'Add an expense', target: { kind: 'group', screen: 'expense' } },
  },
  {
    id: 'items',
    topic: 'adding',
    question: 'How do I split a bill item by item?',
    answer: [
      'In the form, choose Items under Split. Add each item with its price and tap who had it; something shared goes to everyone who had it.',
      'Put tax, service and tip in the last field, and Quits shares it in proportion to what everyone had.',
    ],
    keywords: ['items', 'receipt', 'restaurant', 'dinner', 'tip', 'service', 'tax'],
    show: { label: 'Split a bill by item', target: { kind: 'group', screen: 'items' } },
  },
  {
    id: 'sums',
    topic: 'adding',
    question: 'Can I type a sum into an amount?',
    answer: ['Yes. “4800÷3” or “12.50 + 3.20 × 2” works in any amount field, worked out exactly. On a phone, the + − × ÷ keys sit under the amount.'],
    keywords: ['calculator', 'maths', 'math', 'divide', 'multiply', 'add', 'sum'],
    show: { label: 'Add an expense', target: { kind: 'group', screen: 'expense' } },
  },
  {
    id: 'currency',
    topic: 'adding',
    question: 'What if something was paid in another currency?',
    answer: [
      'Choose its currency beside the amount. Quits looks up the European Central Bank’s rate for that day, or you can type the rate you actually got.',
      'The rate is fixed when you save, so the expense never changes later. Without a connection, or for a currency the bank doesn’t cover, type the rate: Quits reads it back so a thousands comma can’t become a decimal point.',
    ],
    keywords: ['currency', 'exchange', 'rate', 'ecb', 'convert', 'euro', 'dollar', 'yen', 'pound', 'abroad', 'travel'],
    show: { label: 'Add an expense', target: { kind: 'group', screen: 'expense' } },
  },
  {
    id: 'fewest',
    topic: 'settling',
    question: 'How does Quits find the fewest payments?',
    answer: [
      'It looks for groups of people whose balances cancel each other out. If everyone splits into k such circles, the group settles in n − k payments and never fewer, and Quits checks every way of splitting it, so its plan is the shortest possible.',
      'On Settle up, switch to Pair by pair to see how many payments paying everyone back directly would take.',
    ],
    keywords: ['settle', 'payments', 'fewest', 'minimum', 'simplify', 'debts', 'plan', 'algorithm'],
    show: { label: 'See a plan', target: { kind: 'group', screen: 'settle' } },
  },
  {
    id: 'record',
    topic: 'settling',
    question: 'How do I record a payment?',
    answer: [
      'On Settle up, tap Mark paid when someone pays their part of the plan. Use Record a payment for a different amount, or one made outside the plan.',
      'Payments made lists every payment, and you can delete one there.',
    ],
    keywords: ['paid', 'payment', 'mark', 'record', 'repay', 'transfer', 'settled'],
    show: { label: 'Open Settle up', target: { kind: 'group', screen: 'settle' } },
  },
  {
    id: 'why-owe',
    topic: 'settling',
    question: 'Why do I owe this much?',
    answer: ['Open Balances and tap a person to see every expense and payment behind their balance, line by line, adding up exactly.'],
    keywords: ['balance', 'owe', 'owed', 'statement', 'explain', 'breakdown', 'why'],
    show: { label: 'See a statement', target: { kind: 'group', screen: 'statement' } },
  },
  {
    id: 'spending',
    topic: 'settling',
    question: 'Where did the money go?',
    answer: ['On a group’s Expenses tab, tap See all under Where it went: spending by category, over time by day, week or month, and who paid against who used.'],
    keywords: ['spending', 'chart', 'category', 'report', 'total', 'budget', 'insights'],
    show: { label: 'See the spending', target: { kind: 'group', screen: 'spending' } },
  },
  {
    id: 'share',
    topic: 'sharing',
    question: 'How do I share a group with friends?',
    answer: [
      'Tap the share button at the top of a group, give your name, and send the link. Your friend opens it, picks which person they are, and gets a copy of their own.',
      'The group travels inside the link itself, so nothing goes to a server. Anyone with the link can read the group, so send it only to the people in it.',
    ],
    keywords: ['share', 'link', 'send', 'friend', 'invite', 'whatsapp', 'message'],
    show: { label: 'Share a group', target: { kind: 'group', screen: 'share' } },
  },
  {
    id: 'copies',
    topic: 'sharing',
    question: 'Do shared copies stay in step?',
    answer: ['No: each copy is its own. To bring a friend up to date, share the group again. Opening a newer link offers to update their copy rather than add a second one.'],
    keywords: ['sync', 'update', 'copy', 'together', 'live'],
  },
  {
    id: 'backup',
    topic: 'sharing',
    question: 'How do I move my groups to another device?',
    answer: [
      'In About, Save a backup keeps every group in a file. On the other device, open About and use Restore a backup to put them back.',
      'Restoring replaces the groups that were on that device.',
    ],
    keywords: ['backup', 'restore', 'move', 'phone', 'export', 'import', 'file', 'transfer'],
    show: { label: 'Open About', target: { kind: 'route', href: '/about' } },
  },
  {
    id: 'privacy',
    topic: 'data',
    question: 'Where are my groups kept?',
    answer: ['On this device only. Quits has no account, no server of its own and no tracking. The privacy page says exactly when anything leaves the device.'],
    keywords: ['privacy', 'data', 'stored', 'cloud', 'account', 'tracking', 'safe'],
    show: { label: 'Read about privacy', target: { kind: 'route', href: '/privacy' } },
  },
  {
    id: 'unreadable',
    topic: 'data',
    question: 'What if Quits can’t read my saved data?',
    answer: [
      'It sets the data aside instead of writing over it, opens as normal, and tells you on the groups screen. Save a copy to keep it, then delete it there.',
      'If one group can’t be read, the others still open.',
    ],
    keywords: ['corrupt', 'broken', 'lost', 'missing', 'damaged', 'error', 'recover'],
  },
  {
    id: 'not-saving',
    topic: 'data',
    question: 'Why does Quits say my browser isn’t saving?',
    answer: ['Some browsers block a site’s storage, often in a private window. Quits keeps working, but your changes only last until you close it: save a backup to keep them, or let the site store data.'],
    keywords: ['saving', 'storage', 'private', 'incognito', 'lost', 'browser'],
    show: { label: 'Open About', target: { kind: 'route', href: '/about' } },
  },
  {
    id: 'problem',
    topic: 'data',
    question: 'Something isn’t working. Who do I tell?',
    answer: ['Use Report a problem in About. It opens a new issue on GitHub with the version filled in, and nothing from your groups goes with it.'],
    keywords: ['bug', 'problem', 'report', 'issue', 'contact', 'support', 'feedback', 'broken'],
    show: { label: 'Open About', target: { kind: 'route', href: '/about' } },
  },
] as const satisfies readonly HelpEntry[];

/** An answer's id. A “?” in the app can only name one that exists: anything else won't compile. */
export type HelpId = (typeof ENTRIES)[number]['id'];

export const HELP: readonly HelpEntry[] = ENTRIES;

/** Keyboard shortcuts, on a computer. */
export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: 'N', does: 'Add an expense in the open group, or start a group from the list' },
  { keys: 'Q', does: 'Quick add in the open group' },
  { keys: '/', does: 'Search the open group’s expenses' },
  { keys: '?', does: 'Open this help' },
  { keys: 'Esc', does: 'Close a sheet' },
];

export const helpEntry = (id: string) => HELP.find((entry) => entry.id === id);

/**
 * The entries matching a search, best first: every word must appear in the
 * question, the answer or the extra words, ignoring case and accents. A
 * match in the question counts for more than one in the answer.
 */
export function searchHelp(query: string): readonly HelpEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return HELP;
  return HELP.map((entry) => {
    const question = fold(entry.question);
    const rest = fold([...entry.answer, ...entry.keywords].join(' '));
    if (!words.every((word) => question.includes(word) || rest.includes(word))) return null;
    return { entry, score: words.filter((word) => question.includes(word)).length };
  })
    .filter((hit): hit is { entry: HelpEntry; score: number } => hit !== null)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.entry);
}

/** Where "Show me" goes for this person: into the demo trip if it's still here, or their first group. */
export function hrefFor(target: HelpTarget, groups: Group[]): Href | null {
  if (target.kind === 'route') return target.href;
  const group = groups.find((item) => item.id === 'demo_japan') ?? groups[0];
  if (!group) return null;
  const { id } = group;
  switch (target.screen) {
    case 'expense':
      return { pathname: '/group/[id]/expense', params: { id } };
    case 'items':
      return { pathname: '/group/[id]/expense', params: { id, split: 'items' } };
    case 'quick':
      return { pathname: '/group/[id]', params: { id, open: 'quick' } };
    case 'share':
      return { pathname: '/group/[id]', params: { id, open: 'share' } };
    case 'settle':
      return { pathname: '/group/[id]', params: { id, tab: 'settle' } };
    case 'balances':
      return { pathname: '/group/[id]', params: { id, tab: 'balances' } };
    case 'spending':
      return { pathname: '/group/[id]/spending', params: { id } };
    case 'statement': {
      const other = group.members.find((member) => member.id !== group.me);
      return other ? { pathname: '/group/[id]/member/[memberId]', params: { id, memberId: other.id } } : { pathname: '/group/[id]', params: { id, tab: 'balances' } };
    }
  }
}
