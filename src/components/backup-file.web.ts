import * as DocumentPicker from 'expo-document-picker';

/** Downloads the backup as a file. */
export async function saveBackupFile(name: string, text: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Asks for a backup file and reads it, or null if none was chosen. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled) return null;
  const [asset] = result.assets;
  return asset.file ? asset.file.text() : (await fetch(asset.uri)).text();
}
