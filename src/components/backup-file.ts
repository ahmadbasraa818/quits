import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** The kinds of file Quits saves: a backup, and a spreadsheet of a group. */
const KINDS = {
  json: { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Save a backup' },
  csv: { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Save a spreadsheet' },
} as const;

export type FileKind = keyof typeof KINDS;

/** Writes text to a file and offers it to the share sheet: Files, Drive, email, AirDrop. */
export async function saveTextFile(name: string, text: string, kind: FileKind): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, KINDS[kind]);
}

/** Writes the backup to a file and offers it to the share sheet. */
export const saveBackupFile = (name: string, text: string) => saveTextFile(name, text, 'json');

/** Asks for a backup file and reads it, or null if none was chosen. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
  if (result.canceled) return null;
  return new File(result.assets[0].uri).text();
}
