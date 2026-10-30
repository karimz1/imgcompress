/**
 * Copies text from a click handler. navigator.clipboard only exists on HTTPS
 * or localhost, so on a plain-http server (http://imgcompress.lan on an
 * iPhone) it falls back to a hidden text field and execCommand("copy").
 * Call it straight from the click, before any await, so the browser still
 * sees the user's tap. Resolves to false only when both ways fail.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof window !== "undefined" && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyWithTextArea(text);
    }
  }
  return copyWithTextArea(text);
}

function copyWithTextArea(text: string): boolean {
  if (typeof document === "undefined") return false;
  const previous = document.activeElement as HTMLElement | null;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  // 16px stops iOS from zooming in; off-screen so nothing flashes.
  Object.assign(area.style, { position: "fixed", top: "0", left: "-9999px", fontSize: "16px", opacity: "0" });
  // Inside an open dialog the focus trap would steal focus from a field on <body>.
  const host = previous?.closest('[role="dialog"]') ?? document.body;
  host.appendChild(area);
  try {
    // iOS only selects in an editable field, and only with setSelectionRange.
    area.contentEditable = "true";
    area.readOnly = false;
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    area.readOnly = true;
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
    previous?.focus?.();
  }
}
