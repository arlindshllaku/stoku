import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, LoaderCircle } from 'lucide-react'

type Props = { base: string; token: string }
const types = { sales: 'Shitjet', exchanges: 'Ndërrimet', purchases: 'Blerjet', inventory: 'Lëvizjet e inventarit', stock: 'Stoku aktual' }
type ReportType = keyof typeof types
type Report = { title: string; headings: string[]; rows: (string | number | null)[][]; total: number; page: number; last_page: number; summary: { count: number; amount: number }; generated_at: string }
const input = 'ui-input'
const button = 'ui-button'
const today = () => new Date().toLocaleDateString('en-CA')

async function request<T>(base: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base + path, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(Object.values(error.errors ?? {}).flat().join(' ') || error.message || 'Kërkesa dështoi.')
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function ReportHub({ base, token }: Props) {
  const [type, setType] = useState<ReportType>('sales')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [page, setPage] = useState(1)
  const [selectedPeriod, setSelectedPeriod] = useState('daily')
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setReport(null)
      setError('')
      if (!from || !to || from > to) { setLoading(false); setError('Zgjidhni një periudhë të vlefshme.'); return }
      setLoading(true)
      void request<Report>(base, token, '/report-data/' + type + '?' + new URLSearchParams({ from, to, page: String(page) }), { signal: controller.signal })
        .then(setReport).catch(error => { if (error.name !== 'AbortError') setError(error.message) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 250)
    return () => { controller.abort(); window.clearTimeout(timer) }
  }, [base, token, type, from, to, page])
  async function download(format: string) {
    setExporting(true); setError('')
    try {
      const response = await fetch(base + '/report-data/' + type + '?' + new URLSearchParams({ from, to, format }), { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } })
      if (!response.ok) { const result = await response.json(); throw new Error(Object.values(result.errors ?? {}).flat().join(' ') || result.message) }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = type + '-' + from + '.' + format; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) { setError(error instanceof Error ? error.message : 'Eksporti dështoi.') } finally { setExporting(false) }
  }
  function period(value: string) {
    setSelectedPeriod(value)
    if (value === 'custom') return
    const date = new Date(); setTo(today()); setPage(1)
    if (value === 'weekly') date.setDate(date.getDate() - 6)
    if (value === 'monthly') date.setDate(1)
    setFrom(date.toLocaleDateString('en-CA'))
  }
  return <section className="report-workspace" aria-label="Raportet e dyqanit">
    <div className="ui-card report-toolbar">
      <div className={`report-filter-grid ${type === 'stock' ? 'report-stock-filter' : ''}`}>
      <label className="ui-field">Raporti<select aria-label="Raporti" className={input} value={type} onChange={event => { setType(event.target.value as ReportType); setPage(1) }}>{Object.entries(types).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      {type !== 'stock' && <>
      <label className="ui-field">Periudha<select aria-label="Periudha" className={input} value={selectedPeriod} onChange={event => period(event.target.value)}><option value="daily">Sot</option><option value="weekly">7 ditët e fundit</option><option value="monthly">Muaji aktual</option><option value="custom">E personalizuar</option></select></label>
      <label className="ui-field">Nga<input aria-label="Nga" className={input} type="date" value={from} onChange={event => { setFrom(event.target.value); setSelectedPeriod('custom'); setPage(1) }} /></label>
      <label className="ui-field">Deri<input aria-label="Deri" className={input} type="date" min={from} value={to} onChange={event => { setTo(event.target.value); setSelectedPeriod('custom'); setPage(1) }} /></label>
      </>}
      </div><div className="report-export-actions">
      <button className={button} disabled={!report || exporting} onClick={() => void download('xlsx')}><FileSpreadsheet size={17} />Excel</button>
      <button className={button + ' ui-button-primary'} disabled={!report || exporting} onClick={() => void download('pdf')}>{exporting ? <LoaderCircle className="ui-spin" size={17} /> : <Download size={17} />}PDF</button>
      </div>
    </div>
    {type === 'stock' && <p className="text-sm text-slate-600">Gjendja aktuale e stokut në momentin e gjenerimit.</p>}
    {type === 'inventory' && <p className="text-sm text-slate-600">Hyrjet, daljet dhe korrigjimet gjatë periudhës së zgjedhur.</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {loading && <div role="status" className="ui-card ui-loading"><LoaderCircle className="ui-spin" size={22} />Duke ngarkuar raportin…</div>}
    {report && <div className="ui-card report-results"><div className="report-summary"><div><p className="ui-eyebrow">Përmbledhja e raportit</p><h2>{report.title}</h2><p className="ui-hint">{report.summary.count} regjistrime · Gjeneruar {report.generated_at}</p></div><div className="report-summary-amount"><span className="ui-hint">{({ sales: 'Qarkullimi', exchanges: 'Cash neto', purchases: 'Paguar', inventory: 'Kosto e lëvizjeve', stock: 'Vlera e stokut' })[type]}</span><strong>{report.summary.amount.toLocaleString('sq-AL', { style: 'currency', currency: 'EUR' })}</strong></div></div>
      <div className="report-desktop-table"><table className="ui-data-table"><thead><tr>{report.headings.map(heading => <th scope="col" className={heading.includes('EUR') ? 'ui-number' : ''} key={heading}>{heading}</th>)}</tr></thead><tbody>{report.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <td className={report.headings[j]?.includes('EUR') ? 'ui-number' : ''} key={j}>{value ?? '-'}</td>)}</tr>)}</tbody></table></div>
      <div className="report-mobile-records">{report.rows.map((row, i) => <article className="report-mobile-record" key={i}><dl>{row.map((value, j) => <div key={j}><dt>{report.headings[j]}</dt><dd>{value ?? '-'}</dd></div>)}</dl></article>)}</div>
      {!report.rows.length && <div className="ui-empty"><h3>Nuk ka të dhëna për këtë periudhë</h3><p>Provoni një periudhë ose raport tjetër.</p></div>}
      <div className="ui-pagination"><span>Faqja <strong>{report.page}</strong> nga {report.last_page}</span><div><button className={button} disabled={page <= 1} onClick={() => setPage(1)}>Fillimi</button><button className={button} disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Faqja e mëparshme"><ChevronLeft size={17} /></button><button className={button} disabled={page >= report.last_page} onClick={() => setPage(page + 1)} aria-label="Faqja e ardhshme"><ChevronRight size={17} /></button><button className={button} disabled={page >= report.last_page} onClick={() => setPage(report.last_page)}>Fundi</button></div></div>
    </div>}
  </section>
}

export { ReportSettings } from './ReportSettings'
