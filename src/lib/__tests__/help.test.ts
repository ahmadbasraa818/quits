import { demoGroups } from '@/store/demo';

import { HELP, hrefFor, searchHelp, SHORTCUTS, TOPICS } from '../help';
import { compareVersions } from '../version';

const [japan, flat] = demoGroups(new Date(2026, 9, 9));

describe('the help', () => {
  it('has a unique id, a known topic, a question and an answer for every entry', () => {
    const ids = HELP.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of HELP) {
      expect(TOPICS.map((topic) => topic.id)).toContain(entry.topic);
      expect(entry.question).toMatch(/\?$/);
      expect(entry.answer.length).toBeGreaterThan(0);
    }
  });

  it('lists every shortcut once', () => {
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.keys)).size).toBe(SHORTCUTS.length);
  });
});

describe('searching the help', () => {
  it('shows everything for an empty search', () => {
    expect(searchHelp('  ')).toEqual(HELP);
  });

  it('finds an answer by its question first, ignoring case and accents', () => {
    expect(searchHelp('CURRÉNCY')[0].id).toBe('currency');
    expect(searchHelp('fewest payments')[0].id).toBe('fewest');
  });

  it('finds an answer by words that are only in its answer or extra words', () => {
    expect(searchHelp('incognito').map((entry) => entry.id)).toEqual(['not-saving']);
    expect(searchHelp('receipt').map((entry) => entry.id)).toContain('items');
  });

  it('needs every word to match', () => {
    expect(searchHelp('currency backup')).toEqual([]);
    expect(searchHelp('zebra')).toEqual([]);
  });
});

describe('where “Show me” goes', () => {
  it('goes straight to a screen of the app', () => {
    expect(hrefFor({ kind: 'route', href: '/privacy' }, [])).toBe('/privacy');
  });

  it('opens the demo trip when it’s here, at the right place', () => {
    expect(hrefFor({ kind: 'group', screen: 'settle' }, [flat, japan])).toEqual({ pathname: '/group/[id]', params: { id: 'demo_japan', tab: 'settle' } });
    expect(hrefFor({ kind: 'group', screen: 'items' }, [japan])).toEqual({ pathname: '/group/[id]/expense', params: { id: 'demo_japan', split: 'items' } });
    expect(hrefFor({ kind: 'group', screen: 'quick' }, [japan])).toEqual({ pathname: '/group/[id]', params: { id: 'demo_japan', open: 'quick' } });
    expect(hrefFor({ kind: 'group', screen: 'statement' }, [japan])).toEqual({ pathname: '/group/[id]/member/[memberId]', params: { id: 'demo_japan', memberId: 'aiko' } });
  });

  it('uses the person’s first group without the demo, and nothing without a group', () => {
    expect(hrefFor({ kind: 'group', screen: 'spending' }, [flat])).toEqual({ pathname: '/group/[id]/spending', params: { id: 'demo_flat' } });
    expect(hrefFor({ kind: 'group', screen: 'expense' }, [])).toBeNull();
  });
});

describe('comparing versions', () => {
  it('compares each part as a number', () => {
    expect(compareVersions('2.10.0', '2.9.1')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    expect(compareVersions('2.1', '2.1.0')).toBe(0);
  });
});
