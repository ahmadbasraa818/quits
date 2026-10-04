import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { shareLink } from '@/lib/share-link';
import type { Group } from '@/lib/types';
import { useGroups } from '@/store/groups';
import { space } from '@/theme';

import { Button } from './button';
import { Field } from './field';
import { SectionLabel } from './layout';
import { Sheet } from './sheet';
import { shareText } from './share';
import { Text } from './text';
import { useToast } from './toast';

/** Past this, some apps cut a link short when it's pasted. */
const LONG_LINK = 8000;

/**
 * Sends a copy of the group as a link. Friends open it and get their own
 * copy, with everything in it so far; the group travels in the link itself,
 * so no server is involved. Copies don't stay in step: sharing again sends
 * an update, which a copy can take.
 */
export function ShareCopy({ group, visible, onClose }: { group: Group; visible: boolean; onClose: () => void }) {
  const prepareShare = useGroups((state) => state.prepareShare);
  const showToast = useToast((state) => state.show);
  const current = group.members.find((member) => member.id === group.me)?.name ?? '';
  const [name, setName] = useState(current === 'You' ? '' : current);
  const taken = group.members.some((member) => member.id !== group.me && member.name.trim().toLowerCase() === name.trim().toLowerCase());
  const problem = name.trim() === '' ? 'Add your name, so friends know which one is you.' : name.trim().toLowerCase() === 'you' ? 'Your friends will each be “You” in their copy: use your name.' : taken ? `Someone in ${group.name} is already called ${name.trim()}.` : null;
  // For the length warning: the link as it will be, near enough.
  const preview = shareLink({ ...group, members: group.members.map((member) => (member.id === group.me ? { ...member, name: name.trim() } : member)) });

  const share = async () => {
    if (problem) return;
    const prepared = prepareShare(group.id, name);
    if (!prepared) return;
    const result = await shareText(`Here’s ${group.name} on Quits, so you can see where we stand: ${shareLink(prepared)}`);
    if (result === 'copied') showToast('Link copied, ready to send');
    else if (result === 'failed') showToast('Couldn’t share the link from here');
    if (result !== 'cancelled') onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Share ${group.name}`}
      testID="share-copy"
      footer={<Button label="Share a link" icon="link" disabled={problem !== null} onPress={share} testID="share-link" />}
    >
      <View style={styles.body}>
        <Text variant="body" tone="muted">
          Friends open the link and get their own copy of {group.name}, with everything in it so far. Changes after that don’t travel on their own: share again to send an update.
        </Text>
        <View>
          <SectionLabel>Your name</SectionLabel>
          <Field testID="my-name" accessibilityLabel="Your name, as friends will see it" value={name} onChangeText={setName} placeholder="So friends know which one is you" maxLength={24} autoFocus />
          {problem && name !== '' ? (
            <Text variant="label" tone="negative" style={styles.note} testID="share-problem">
              {problem}
            </Text>
          ) : null}
        </View>
        <Text variant="caption" tone="muted">
          The group travels inside the link, after the #, which browsers never send to a server.
          {preview.length > LONG_LINK ? ' It’s a big group, so some apps may cut the link short; if one does, send it by email.' : ''}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space(5), paddingBottom: space(2), gap: space(3) },
  note: { marginTop: space(2) },
});
