/**
 * M5.3: Web Share API helper.
 */
function canShare() {
  return typeof navigator !== 'undefined' && !!navigator.share;
}

export async function shareText(title, text) {
  if (!canShare()) {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      return { shared: false, copied: true };
    } catch {
      return { shared: false, copied: false };
    }
  }

  try {
    await navigator.share({ title, text });
    return { shared: true };
  } catch (e) {
    if (e.name === 'AbortError') return { shared: false, cancelled: true };
    return { shared: false, error: e.message };
  }
}
