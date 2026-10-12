/**
 * Hand a file to the user. On touch devices, the share sheet is the reliable
 * way to save from an installed PWA (iOS ignores `download` links there);
 * elsewhere, a normal download. Call from a tap: sharing needs a user gesture.
 */
export async function saveFile(file: File): Promise<void> {
  const prefersShare =
    typeof navigator.canShare === 'function' &&
    window.matchMedia('(pointer: coarse)').matches &&
    navigator.canShare({ files: [file] });

  if (prefersShare) {
    try {
      await navigator.share({ files: [file], title: file.name });
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
