import { RELEASES, releasesSince } from '@/components/whats-new';
import { compareVersions } from '@/lib/version';

import app from '../../../app.json';
import { demoGroups } from '../demo';
import { isDemo, useGroups } from '../groups';
import { FIRST_TRACKED, settleFirstRun, useSettings } from '../settings';

beforeEach(() => {
  useSettings.setState({ welcomeDone: false, seenVersion: null });
  useGroups.getState().replaceAll(demoGroups());
});

describe('the first start', () => {
  it('welcomes a new person, with nothing to catch up on', () => {
    settleFirstRun(false, app.expo.version);
    expect(useSettings.getState()).toMatchObject({ welcomeDone: false, seenVersion: app.expo.version });
    expect(releasesSince(useSettings.getState().seenVersion)).toEqual([]);
  });

  it('shows someone who used Quits before what changed, without the welcome', () => {
    settleFirstRun(true, app.expo.version);
    expect(useSettings.getState()).toMatchObject({ welcomeDone: true, seenVersion: FIRST_TRACKED });
    expect(releasesSince(FIRST_TRACKED).map((release) => release.version)).toEqual(RELEASES.map((release) => release.version));
  });

  it('happens once: what was recorded stays', () => {
    useSettings.setState({ seenVersion: '2.0.0' });
    settleFirstRun(false, app.expo.version);
    expect(useSettings.getState().seenVersion).toBe('2.0.0');
  });
});

describe('the release notes', () => {
  it('start with this version of the app, newest first', () => {
    expect(RELEASES[0].version).toBe(app.expo.version);
    for (let index = 1; index < RELEASES.length; index += 1) expect(compareVersions(RELEASES[index - 1].version, RELEASES[index].version)).toBeGreaterThan(0);
  });

  it('list only what’s newer than the version last seen', () => {
    expect(releasesSince(RELEASES[1].version).map((release) => release.version)).toEqual([RELEASES[0].version]);
    expect(releasesSince('2.0.0').map((release) => release.version)).toContain('2.1.0');
    expect(releasesSince('2.0.0').map((release) => release.version)).not.toContain('2.0.0');
    expect(releasesSince(RELEASES[0].version)).toEqual([]);
    expect(releasesSince(null)).toEqual([]);
  });
});

describe('the demo groups', () => {
  const own = () => useGroups.getState().createGroup({ name: 'Ski trip', currency: 'EUR', memberNames: ['Lena'] });

  it('reset without touching the person’s own groups, and undo puts things back', () => {
    const id = own();
    useGroups.getState().removeExpense('demo_japan', 'japan_e0');
    const before = useGroups.getState().resetDemo();
    const after = useGroups.getState().groups;
    expect(after.some((group) => group.id === id)).toBe(true);
    expect(after.find((group) => group.id === 'demo_japan')?.expenses.some((expense) => expense.id === 'japan_e0')).toBe(true);
    useGroups.getState().replaceAll(before);
    expect(useGroups.getState().groups.find((group) => group.id === 'demo_japan')?.expenses.some((expense) => expense.id === 'japan_e0')).toBe(false);
  });

  it('can be removed, leaving the person’s own groups', () => {
    const id = own();
    const before = useGroups.getState().removeDemo();
    expect(useGroups.getState().groups.map((group) => group.id)).toEqual([id]);
    expect(before.filter(isDemo)).toHaveLength(3);
  });
});
