import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { Button } from './button';
import type { IconName } from './icon';
import { Sheet } from './sheet';
import { Text } from './text';

/**
 * Asks before doing something that can't be taken back with a tap. The same
 * on every platform: the web has no native alert to fall back on.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  icon = 'trash',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  icon?: IconName;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      testID="confirm-dialog"
      footer={
        <View style={styles.actions}>
          <Button label={confirmLabel} variant="destructive" icon={icon} onPress={onConfirm} testID="confirm" />
          <Button label="Cancel" variant="secondary" onPress={onCancel} testID="cancel" />
        </View>
      }
    >
      <Text variant="body" tone="muted" style={styles.message}>
        {message}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  message: { paddingHorizontal: space(5), paddingBottom: space(2) },
  actions: { gap: space(2) },
});
