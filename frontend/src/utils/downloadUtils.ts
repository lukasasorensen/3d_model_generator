/**
 * Download Utilities
 * Helper functions for file downloads and blob URL management.
 */

/**
 * Creates a blob URL from content string.
 * Remember to revoke the URL when done using URL.revokeObjectURL(url)
 */
export function createBlobUrl(content: string, mimeType: string = "text/plain"): string {
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Downloads content as a file.
 * Automatically handles blob URL creation and cleanup.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain"
): void {
  const url = createBlobUrl(content, mimeType);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Copies text content to clipboard.
 * Returns a promise that resolves when the copy is complete.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
