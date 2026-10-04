import { useState } from 'react';

/**
 * The value, or the last one seen once it's gone. A screen whose group or
 * expense was just deleted keeps showing it while it animates away, rather
 * than flashing "not found" on its way out.
 */
export function useLastDefined<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  if (value !== undefined && value !== last) setLast(value);
  return value ?? last;
}
