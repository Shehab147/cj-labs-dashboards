/**
 * Print HTML content.
 * If running inside pywebview (desktop app), calls the exposed print_html_direct API
 * which converts to PDF via wkhtmltopdf and sends to the default printer.
 * Otherwise, falls back to a hidden iframe for printing (works in webview and browsers).
 */
export function printHtml(html: string): void {
  const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null

  if (pywebview?.api?.print_html_direct) {
    pywebview.api.print_html_direct(html)
  } else {
    // Hidden iframe approach — works inside pywebview and regular browsers
    const iframe = document.createElement('iframe')

    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.srcdoc = html

    document.body.appendChild(iframe)

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print()
        setTimeout(() => document.body.removeChild(iframe), 1000)
      }, 300)
    }
  }
}
