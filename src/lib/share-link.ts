import { deflateSync, Inflate, strFromU8, strToU8 } from 'fflate';

import { APP_URL } from './plan-text';
import type { Group } from './types';
import { validateGroup } from './validate';

/** Marks the format, so a later one can be told apart. */
const PREFIX = 'q1.';
/** The most a shared group may unpack to: generous for any real group, small enough to stop a crafted link. */
const MAX_UNPACKED = 2_000_000;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const LOOKUP = new Map([...ALPHABET].map((char, index) => [char, index]));

/** Bytes as URL-safe base64, without padding. Written out, as atob and btoa aren't everywhere. */
function toBase64Url(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const word = (a << 16) | (b << 8) | c;
    const chars = [word >> 18, (word >> 12) & 63, (word >> 6) & 63, word & 63].map((n) => ALPHABET[n]);
    text += chars.slice(0, i + 2 < bytes.length ? 4 : i + 1 < bytes.length ? 3 : 2).join('');
  }
  return text;
}

function fromBase64Url(text: string): Uint8Array | null {
  if (text.length % 4 === 1) return null;
  const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
  let byte = 0;
  for (let i = 0; i < text.length; i += 4) {
    const values = [...text.slice(i, i + 4)].map((char) => LOOKUP.get(char));
    if (values.some((value) => value === undefined)) return null;
    const [a, b, c = 0, d = 0] = values as number[];
    const word = (a << 18) | (b << 12) | (c << 6) | d;
    bytes[byte++] = word >> 16;
    if (values.length > 2) bytes[byte++] = (word >> 8) & 255;
    if (values.length > 3) bytes[byte++] = word & 255;
  }
  return bytes;
}

/** Text deflated and written in URL-safe base64, behind the format's marker. */
export function packText(text: string): string {
  return PREFIX + toBase64Url(deflateSync(strToU8(text), { level: 9 }));
}

/** A group packed small enough to travel in a link. */
export function encodeGroup(group: Group): string {
  return packText(JSON.stringify(group));
}

/** The group a link carries, or null if it's damaged, too big, or not a group at all. */
export function decodeGroup(text: string): Group | null {
  if (!text.startsWith(PREFIX)) return null;
  const packed = fromBase64Url(text.slice(PREFIX.length));
  if (!packed) return null;
  try {
    // Unpacked a piece at a time, stopping at the limit, so a crafted link can't fill the memory.
    const pieces: Uint8Array[] = [];
    let size = 0;
    const inflater = new Inflate((piece) => {
      size += piece.length;
      if (size > MAX_UNPACKED) throw new Error('Too big');
      pieces.push(piece);
    });
    inflater.push(packed, true);
    const joined = new Uint8Array(size);
    let offset = 0;
    for (const piece of pieces) {
      joined.set(piece, offset);
      offset += piece.length;
    }
    return validateGroup(JSON.parse(strFromU8(joined)));
  } catch {
    return null;
  }
}

/**
 * A link that opens Quits with a copy of the group. The group travels in the
 * part after the #, which browsers never send to a server.
 */
export function shareLink(group: Group): string {
  return `${APP_URL}import#${encodeGroup(group)}`;
}
