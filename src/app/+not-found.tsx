import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/layout';
import { Text } from '@/components/text';
import { space } from '@/theme';

export default function NotFound() {
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space(4), padding: space(6) }}>
        <Text variant="title" accessibilityRole="header">
          Nothing here
        </Text>
        <Text variant="body" tone="muted" style={{ textAlign: 'center' }}>
          That page doesn’t exist. Your groups are a tap away.
        </Text>
        <Button label="See your groups" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
