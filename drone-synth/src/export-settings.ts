import { loadSettings, snapshotSettings } from './persistence';

export function downloadSettings(): void {
  const blob = new Blob([JSON.stringify(snapshotSettings(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  link.href = url;
  link.download = `strata-settings-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function handleSettingsFile(file: File | undefined | null): Promise<void> {
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    loadSettings(raw);
  } catch (error) {
    alert(error instanceof Error && error.message ? error.message : 'Could not load settings JSON.');
  }
}
