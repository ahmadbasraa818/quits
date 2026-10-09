import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { helpEntry, type HelpId } from '@/lib/help';
import { useTheme } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';

/** A small “?” that opens help at the answer about the thing beside it. */
export function HelpLink({ id }: { id: HelpId }) {
  const theme = useTheme();
  const entry = helpEntry(id);
  if (!entry) return null;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Help: ${entry.question}`}
      hitSlop={12}
      onPress={() => router.push({ pathname: '/help', params: { entry: id } })}
      testID={`help-${id}`}
      style={styles.link}
    >
      <Icon name="question" size={18} color={theme.inkMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  link: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
