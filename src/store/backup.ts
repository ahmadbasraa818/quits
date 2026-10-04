import type { Group } from '@/lib/types';
import { validateGroup } from '@/lib/validate';

import { migrate, STORE_VERSION } from './migrations';

/** Every group, as a file that can be kept anywhere and restored on any device. */
export function toBackup(groups: Group[], now = new Date()): string {
  return JSON.stringify({ app: 'quits', version: STORE_VERSION, savedAt: now.toISOString(), groups }, null, 2);
}

export type Restored = { ok: true; groups: Group[]; savedAt: string } | { ok: false; reason: string };

/**
 * The groups in a backup, brought up to this version of the app, or why the
 * file can't be restored. Every group is checked in full, so a damaged or
 * edited file can't leave the app in a state it can't show.
 */
export function fromBackup(text: string): Restored {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file isn’t a Quits backup.' };
  }
  const file = parsed as { app?: unknown; version?: unknown; savedAt?: unknown; groups?: unknown };
  if (typeof file !== 'object' || file === null || file.app !== 'quits' || !Array.isArray(file.groups) || !Number.isInteger(file.version)) {
    return { ok: false, reason: 'That file isn’t a Quits backup.' };
  }
  const version = file.version as number;
  if (version > STORE_VERSION) return { ok: false, reason: 'That backup is from a newer version of Quits. Reload the app and try again.' };
  const { groups } = migrate({ groups: file.groups }, version);
  // A backup is the person's own data: sound is enough, whatever its size.
  const checked = groups.map((group) => validateGroup(group, 'own'));
  if (checked.some((group) => group === null)) return { ok: false, reason: 'Part of that backup is damaged, so nothing was restored.' };
  if (new Set(groups.map((group) => group.id)).size !== groups.length) return { ok: false, reason: 'That backup has the same group twice, so nothing was restored.' };
  return { ok: true, groups: checked as Group[], savedAt: typeof file.savedAt === 'string' ? file.savedAt : '' };
}
