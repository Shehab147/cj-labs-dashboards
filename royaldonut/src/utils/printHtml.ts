/**
 * Print HTML content.
 * If running inside pywebview (desktop app), calls the exposed print_html API
 * which saves to a temp file and opens it in the default browser with auto-print.
 * Otherwise, falls back to window.open for regular browser usage.
 */
export function printHtml(html: string): void {
  // pywebview exposes APIs on window.pywebview.api
  const pywebview = (window as any).pywebview

  if (pywebview?.api?.print_html) {
    pywebview.api.print_html(html)
  } else {
    const w = window.open('', '_blank')

    if (w) {
      w.document.write(html)
      w.document.close()
    }
  }
}
