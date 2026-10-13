/**
 * Whether saving has to go through the share sheet: the installed iOS app
 * ignores `download` links, and "Save to Files" there is the only way to keep
 * a file. Everywhere else a normal download works.
 */
export function savesViaShareSheet(): boolean {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true &&
    typeof navigator.canShare === 'function'
  );
}

/** Hand a file to the user. Call from a tap: sharing needs a user gesture. */
export async function saveFile(file: File): Promise<void> {
  if (savesViaShareSheet() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // Fall through to a download link.
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
