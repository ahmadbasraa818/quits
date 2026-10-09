import * as DocumentPicker from 'expo-document-picker';

const TYPES = { json: 'application/json', csv: 'text/csv;charset=utf-8' } as const;

export type FileKind = keyof typeof TYPES;

/** Downloads text as a file. */
export async function saveTextFile(name: string, text: string, kind: FileKind): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: TYPES[kind] }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Downloads the backup as a file. */
export const saveBackupFile = (name: string, text: string) => saveTextFile(name, text, 'json');

/** Asks for a backup file and reads it, or null if none was chosen. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled) return null;
  const [asset] = result.assets;
  return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
}
