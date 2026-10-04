import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { localDate } from '@/lib/dates';
import { toBackup } from '@/store/backup';
import { useGroups } from '@/store/groups';
import { forgetSetAside, useRecovery } from '@/store/recovery';
import { radius, space, useTheme } from '@/theme';

import { saveBackupFile } from './backup-file';
import { Button } from './button';
import { ConfirmDialog } from './confirm';
import { Icon } from './icon';
import { Text } from './text';
import { useToast } from './toast';

/** “a”, “a and b”, “a, b and c”. */
const listOf = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** Inside another site's page, such as a portfolio showing the demo, where a blocked store is expected. */
const embedded = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.top !== window.self;

function Notice({ title, body, children, testID }: { title: string; body: string; children: React.ReactNode; testID: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.card, borderColor: theme.negative }]} testID={testID} accessibilityRole="alert">
      <Icon name="warningCircle" size={22} color={theme.negative} />
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="body" tone="muted">
          {body}
        </Text>
        <View style={styles.actions}>{children}</View>
      </View>
    </View>
  );
}

/**
 * What the person should know before anything else: saved data Quits
 * couldn't read and set aside, or a device that isn't keeping their changes.
 */
export function Notices() {
  const setAside = useRecovery((state) => state.setAside);
  const notSaving = useRecovery((state) => state.notSaving);
  const groups = useGroups((state) => state.groups);
  const showToast = useToast((state) => state.show);
  const [deleting, setDeleting] = useState(false);
  const today = localDate(new Date());

  const save = (name: string, text: string, done: string) =>
    saveBackupFile(name, text).then(
      () => (Platform.OS === 'web' ? showToast(done) : undefined),
      () => showToast('That couldn’t be saved')
    );

  if (setAside.length === 0 && (!notSaving || embedded())) return null;
  return (
    <View style={styles.list}>
      {setAside.length > 0 ? (
        <Notice
          testID="notice-set-aside"
          title="Some saved data couldn’t be read"
          body={`Quits couldn’t read ${listOf(setAside.map((item) => item.what))}, so it set ${setAside.length === 1 ? 'it' : 'them'} aside instead of writing over ${setAside.length === 1 ? 'it' : 'them'}. Save a copy to keep ${setAside.length === 1 ? 'it' : 'them'}, then delete ${setAside.length === 1 ? 'it' : 'them'} here.`}
        >
          <Button compact label="Save a copy" icon="downloadSimple" variant="secondary" testID="save-set-aside" onPress={() => save(`quits-unreadable-${today}.json`, JSON.stringify(setAside, null, 2), 'Saved a copy to a file')} />
          <Button compact label="Delete it" icon="trash" variant="ghost" testID="delete-set-aside" onPress={() => setDeleting(true)} />
        </Notice>
      ) : null}
      {notSaving && !embedded() ? (
        <Notice testID="notice-not-saving" title="This browser isn’t saving your changes" body="They’ll last until you close Quits. Save a backup to keep them, or allow this site to store data.">
          <Button compact label="Save a backup" icon="downloadSimple" variant="secondary" testID="save-not-saving" onPress={() => save(`quits-backup-${today}.json`, toBackup(groups), 'Saved a backup to a file')} />
        </Notice>
      ) : null}
      <ConfirmDialog
        visible={deleting}
        title="Delete the unreadable data?"
        message="It can’t be opened in Quits. Once it’s deleted, only a copy you saved will have it."
        confirmLabel="Delete it"
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          forgetSetAside().then(() => showToast('Deleted the unreadable data'));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space(3), marginBottom: space(5) },
  notice: { flexDirection: 'row', gap: space(3), padding: space(4), borderRadius: radius.lg, borderWidth: 1.5 },
  text: { flex: 1, gap: space(1) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space(2), marginTop: space(2) },
});
