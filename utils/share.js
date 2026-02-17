/**
 * M5.3: Web Share API helper.
 */
export function canShare() {
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

export async function shareJSON(title, data, filename = 'lifeos-export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });

  if (canShare() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return { shared: true };
    } catch {
      // fallback below
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { shared: false, downloaded: true };
}
