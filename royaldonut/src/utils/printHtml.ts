/**
 * Print HTML content.
 * In pywebview (desktop app): sends HTML to Python which saves as temp file
 * and triggers the native Windows print dialog via ShellExecute.
 * In browser: uses hidden iframe with window.print().
 */
export function printHtml(html: string): void {
  const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null

  if (pywebview?.api?.print_html_direct) {
    pywebview.api.print_html_direct(html)
  } else {
    // Browser fallback: hidden iframe
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
