import { StyleSheet, View } from 'react-native';

import type { Member } from '@/lib/types';
import { font, useTheme } from '@/theme';

import { Text } from './text';

export function Avatar({
  member,
  size = 36,
  ring = false,
  label,
}: {
  member: Pick<Member, 'name' | 'tone'>;
  size?: number;
  ring?: boolean;
  /** Text to show instead of the initial, such as "+2". */
  label?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.tones[member.tone % theme.tones.length],
          borderWidth: ring ? 2 : 0,
          borderColor: theme.card,
        },
      ]}
    >
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.42, lineHeight: size * 0.5, color: theme.ink }}>
        {label ?? member.name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Overlapping avatars for a group, with a count when there are many. */
export function AvatarStack({ members, size = 28, max = 5 }: { members: Member[]; size?: number; max?: number }) {
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View style={styles.stack} accessible={false}>
      {shown.map((member, index) => (
        <View key={member.id} style={{ marginLeft: index === 0 ? 0 : -size * 0.3 }}>
          <Avatar member={member} size={size} ring />
        </View>
      ))}
      {extra > 0 ? (
        <View style={{ marginLeft: -size * 0.3 }}>
          <Avatar member={{ name: 'more', tone: 5 }} label={`+${extra}`} size={size} ring />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
