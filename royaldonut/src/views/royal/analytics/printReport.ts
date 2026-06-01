import { printHtml } from '@/utils/printHtml'

type PrintMetric = {
  label: string
  value: string | number
}

type PrintTable = {
  title: string
  headers: string[]
  rows: Array<Array<string | number>>
  emptyMessage?: string
}

type PrintList = {
  title: string
  rows: Array<Array<string | number>>
  emptyMessage?: string
}

type PrintReportOptions = {
  title: string
  subtitle?: string
  metrics?: PrintMetric[]
  tables?: PrintTable[]
  lists?: PrintList[]
}

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderMetrics = (metrics: PrintMetric[] = []) => {
  if (metrics.length === 0) return ''

  return `
    <section class="metrics">
      ${metrics
        .map(
          metric => `
            <div class="metric">
              <strong>${escapeHtml(metric.value)}</strong>
              <span>${escapeHtml(metric.label)}</span>
            </div>
          `
        )
        .join('')}
    </section>
  `
}

const renderTable = (table: PrintTable) => `
  <section>
    <h4>${escapeHtml(table.title)}</h4>
    <table>
      <thead>
        <tr>${table.headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${
          table.rows.length === 0
            ? `<tr><td colspan="${table.headers.length}">${escapeHtml(table.emptyMessage || 'لا توجد بيانات')}</td></tr>`
            : table.rows
                .map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
                .join('')
        }
      </tbody>
    </table>
  </section>
`

const renderList = (list: PrintList) => `
  <section>
    <h4>${escapeHtml(list.title)}</h4>
    <table>
      <tbody>
        ${
          list.rows.length === 0
            ? `<tr><td>${escapeHtml(list.emptyMessage || 'لا توجد بيانات')}</td></tr>`
            : list.rows
                .map(
                  row => `
                    <tr>
                      ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}
                    </tr>
                  `
                )
                .join('')
        }
      </tbody>
    </table>
  </section>
`

export const printAnalyticsReport = ({ title, subtitle, metrics = [], tables = [], lists = [] }: PrintReportOptions) => {
  const printedAt = new Date().toLocaleString('ar-SA')

  const html = `
    <html dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>${escapeHtml(title)}</title>
        <style>
          body{font-family:Arial,sans-serif;font-size:13px;max-width:900px;margin:0 auto;padding:20px;color:#1f2937}
          h2,h3,h4{margin:0 0 10px;text-align:center}
          h2{font-size:22px}
          h3{font-size:18px}
          h4{font-size:15px;text-align:right;margin-top:20px}
          .meta{text-align:center;color:#6b7280;margin-bottom:18px}
          .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}
          .metric{border:1px solid #e5e7eb;border-radius:8px;padding:12px;text-align:center}
          .metric strong{display:block;font-size:18px;margin-bottom:4px;color:#111827}
          .metric span{color:#6b7280}
          table{width:100%;border-collapse:collapse;margin-top:8px}
          th,td{padding:8px;border:1px solid #e5e7eb;text-align:right}
          th{background:#f9fafb;font-weight:700}
          section{page-break-inside:avoid}
          @media print{button{display:none}.metrics{grid-template-columns:repeat(4,1fr)}}
        </style>
      </head>
      <body>
        <h2>رويال دونتس</h2>
        <h3>${escapeHtml(title)}</h3>
        <div class="meta">
          ${subtitle ? `${escapeHtml(subtitle)}<br/>` : ''}
          وقت الطباعة: ${escapeHtml(printedAt)}
        </div>
        ${renderMetrics(metrics)}
        ${lists.map(renderList).join('')}
        ${tables.map(renderTable).join('')}
      </body>
    </html>
  `

  printHtml(html)
}
