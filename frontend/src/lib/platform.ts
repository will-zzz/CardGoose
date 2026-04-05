/** True for macOS / iOS / iPadOS — used for ⌘ vs Ctrl in UI hints. */
export function isMacLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}
