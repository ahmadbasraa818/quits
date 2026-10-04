import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { addDays, dayLabel, daysAgo, longDateLabel, monthGrid, monthLabel, parseLocalDate, WEEKDAYS } from '@/lib/dates';
import { radius, space, useTheme } from '@/theme';

import { IconButton } from './button';
import { Chip } from './chip';
import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Sheet } from './sheet';
import { Text } from './text';

/** A month at a time, Monday first. Every day is a button that says its full date. */
export function Calendar({ value, onChange, today = daysAgo(0) }: { value: string; onChange: (date: string) => void; today?: string }) {
  const theme = useTheme();
  const [view, setView] = useState(() => {
    const date = parseLocalDate(value);
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const shift = (months: number) =>
    setView(({ year, month }) => {
      const next = new Date(year, month + months, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <View style={styles.calendar}>
      <View style={styles.header}>
        <IconButton icon="caretLeft" label="Previous month" onPress={() => shift(-1)} testID="previous-month" />
        <Text variant="bodyStrong" accessibilityLiveRegion="polite" testID="calendar-month">
          {monthLabel(view.year, view.month)}
        </Text>
        <IconButton icon="caretRight" label="Next month" onPress={() => shift(1)} testID="next-month" />
      </View>
      <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {WEEKDAYS.map((day) => (
          <Text key={day.long} variant="caption" tone="muted" style={styles.weekday}>
            {day.short}
          </Text>
        ))}
      </View>
      {monthGrid(view.year, view.month).map((week, row) => (
        <View key={row} style={styles.week}>
          {week.map((date, column) => {
            if (!date) return <View key={column} style={styles.cell} />;
            const selected = date === value;
            const isToday = date === today;
            return (
              <Pressable
                key={date}
                testID={`day-${date}`}
                accessibilityRole="button"
                // The web ignores accessibilityState, so there the label carries it.
                accessibilityLabel={`${longDateLabel(date)}${isToday ? ', today' : ''}${selected && Platform.OS === 'web' ? ', selected' : ''}`}
                accessibilityState={{ selected }}
                onPress={() => onChange(date)}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    selected && { backgroundColor: theme.brand },
                    isToday && !selected && { borderWidth: 1.5, borderColor: theme.ink },
                  ]}
                >
                  <Text variant="label" style={{ color: selected ? theme.onBrand : theme.ink, fontVariant: ['tabular-nums'] }}>
                    {Number(date.slice(8))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** A row showing a date, which opens a calendar in a sheet. */
export function DateField({ value, onChange, label = 'Date' }: { value: string; onChange: (date: string) => void; label?: string }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const today = daysAgo(0);
  const pick = (date: string) => {
    onChange(date);
    setOpen(false);
  };
  return (
    <>
      <PressableScale
        testID="date-field"
        haptic
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${longDateLabel(value)}`}
        accessibilityHint="Opens a calendar"
        onPress={() => setOpen(true)}
        style={[styles.field, { backgroundColor: theme.card, borderColor: theme.line }]}
      >
        <Icon name="calendarBlank" size={20} color={theme.ink} />
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {dayLabel(value)}
        </Text>
        <Icon name="caretDown" size={18} color={theme.inkMuted} />
      </PressableScale>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label} testID="date-sheet">
        <View style={styles.quick}>
          <Chip label="Today" selected={value === today} onPress={() => pick(today)} testID="date-today" />
          <Chip label="Yesterday" selected={value === addDays(today, -1)} onPress={() => pick(addDays(today, -1))} testID="date-yesterday" />
        </View>
        {/* Keyed by the date, so reopening shows the chosen month. */}
        <Calendar key={open ? value : 'closed'} value={value} onChange={pick} today={today} />
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  calendar: { paddingHorizontal: space(3), paddingBottom: space(2) },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(1) },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: space(1) },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: space(2), paddingHorizontal: space(5), paddingBottom: space(2) },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: 52,
    paddingHorizontal: space(4),
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
