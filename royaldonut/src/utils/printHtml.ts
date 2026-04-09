/**
 * Print HTML content.
 * In pywebview (desktop app): sends HTML to Python and falls back to browser print if Python fails.
 * In browser: uses hidden iframe with window.print().
 */
export async function printHtml(html: string): Promise<void> {
  const pywebview = typeof window !== 'undefined' ? (window as any).pywebview : null

  if (pywebview?.api?.print_html_direct) {
    try {
      const result = await pywebview.api.print_html_direct(html)

      if (result?.success === false) {
        console.error('pywebview print_html_direct failed:', result)
      } else {
        // Python print succeeded (or returned no explicit error), so do not duplicate.
        return
      }
    } catch (error) {
      console.error('pywebview print_html_direct threw:', error)
    }
  }

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
