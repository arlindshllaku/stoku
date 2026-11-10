import { useEffect, useState } from 'react'
import { Download, Mail, Save, Plus, Pencil, Trash2 } from 'lucide-react'

type Props = { base: string; token: string }
const types = { sales: 'Shitjet', exchanges: 'Ndërrimet', purchases: 'Blerjet', inventory: 'Lëvizjet e inventarit', stock: 'Stoku aktual' }
type ReportType = keyof typeof types
type Report = { title: string; headings: string[]; rows: (string | number | null)[][]; total: number; page: number; last_page: number; summary: { count: number; amount: number }; generated_at: string }
const input = 'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm'
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:opacity-50'
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
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 pb-4">
      <label className="space-y-1 text-sm">Raporti<select aria-label="Raporti" className={input} value={type} onChange={event => { setType(event.target.value as ReportType); setPage(1) }}>{Object.entries(types).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className="space-y-1 text-sm">Periudha<select aria-label="Periudha" className={input} disabled={type === 'stock'} value={selectedPeriod} onChange={event => period(event.target.value)}><option value="daily">Sot</option><option value="weekly">7 ditët e fundit</option><option value="monthly">Muaji aktual</option><option value="custom">E personalizuar</option></select></label>
      <label className="space-y-1 text-sm">Nga<input aria-label="Nga" className={input} disabled={type === 'stock'} type="date" value={from} onChange={event => { setFrom(event.target.value); setSelectedPeriod('custom'); setPage(1) }} /></label>
      <label className="space-y-1 text-sm">Deri<input aria-label="Deri" className={input} disabled={type === 'stock'} type="date" min={from} value={to} onChange={event => { setTo(event.target.value); setSelectedPeriod('custom'); setPage(1) }} /></label>
      <button className={button} disabled={!report || exporting} onClick={() => void download('xlsx')}><Download size={16} />Excel</button>
      <button className={button} disabled={!report || exporting} onClick={() => void download('pdf')}><Download size={16} />PDF</button>
    </div>
    {type === 'stock' && <p className="text-sm text-slate-600">Gjendja aktuale e stokut në momentin e gjenerimit.</p>}
    {type === 'inventory' && <p className="text-sm text-slate-600">Hyrjet, daljet dhe korrigjimet gjatë periudhës së zgjedhur.</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {loading && <p role="status" className="text-sm">Duke ngarkuar raportin...</p>}
    {report && <><div className="flex flex-wrap items-center gap-6"><h2 className="text-lg font-semibold">{report.title}</h2><span>{report.summary.count} regjistrime</span><strong>{({ sales: 'Qarkullimi', exchanges: 'Cash neto', purchases: 'Paguar', inventory: 'Kosto e lëvizjeve', stock: 'Vlera e stokut' })[type]}: {report.summary.amount.toLocaleString('sq-AL', { style: 'currency', currency: 'EUR' })}</strong><span className="text-sm text-slate-500">{report.generated_at}</span></div>
      <div className="overflow-x-auto border-y border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{report.headings.map(heading => <th className="px-3 py-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{report.rows.map((row, i) => <tr className="border-t border-slate-100 hover:bg-slate-50" key={i}>{row.map((value, j) => <td className="min-w-24 max-w-sm whitespace-pre-wrap px-3 py-3" key={j}>{value ?? '-'}</td>)}</tr>)}</tbody></table>{!report.rows.length && <p className="p-4 text-sm">Nuk ka të dhëna për këtë periudhë.</p>}</div>
      <div className="flex flex-wrap items-center gap-2"><span className="mr-auto text-sm">Faqja {report.page} / {report.last_page}</span><button className={button} disabled={page <= 1} onClick={() => setPage(1)}>Fillimi</button><button className={button} disabled={page <= 1} onClick={() => setPage(page - 1)}>Mbrapa</button><button className={button} disabled={page >= report.last_page} onClick={() => setPage(page + 1)}>Përpara</button><button className={button} disabled={page >= report.last_page} onClick={() => setPage(report.last_page)}>Fundi</button></div>
    </>}
  </section>
}

type Rule = { id: number; name: string; recipients: string[]; report_types: ReportType[]; formats: string[]; interval_minutes: number; period_days: number; enabled: boolean; next_run_at: string; last_sent_at: string | null; last_error: string | null }
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const emptyRule = () => ({ name: '', recipients: '', report_types: ['stock'] as ReportType[], formats: ['xlsx', 'pdf'], interval_minutes: 1440, period_days: 1, enabled: true, next_run_at: localTime(new Date(Date.now() + 3600000)) })
const emptySmtp = { host: '', port: 587, encryption: 'tls', username: '', password: '', from_address: '', from_name: 'Stoku' }

export function ReportSettings({ base, token }: Props) {
  const [smtp, setSmtp] = useState(emptySmtp)
  const [rules, setRules] = useState<Rule[]>([])
  const [rule, setRule] = useState(emptyRule)
  const [editing, setEditing] = useState<number | null>(null)
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      request<{ settings: typeof emptySmtp | null }>(base, token, '/smtp', { signal: controller.signal }),
      request<{ data: Rule[] }>(base, token, '/report-automations', { signal: controller.signal }),
    ]).then(([settings, result]) => { setSmtp({ ...emptySmtp, ...settings.settings, password: '' }); setRules(result.data) })
      .catch(error => { if (error.name !== 'AbortError') setMessage(error.message) })
    return () => controller.abort()
  }, [base, token])
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('')
    try { await action() } catch (error) { setMessage(error instanceof Error ? error.message : 'Veprimi dështoi.') } finally { setBusy(false) }
  }
  return <section className="space-y-8">
    <p role="status" className="text-sm text-blue-800">{message}</p>
    <form className="grid gap-3 border-b border-slate-200 pb-6 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void run(async () => { await request(base, token, '/smtp', { method: 'PUT', body: JSON.stringify(smtp) }); setSmtp({ ...smtp, password: '' }); setMessage('SMTP u ruajt.') }) }}>
      <h2 className="font-semibold sm:col-span-2">SMTP i dyqanit</h2>
      {(['host', 'username', 'password', 'from_address', 'from_name'] as const).map(key => <label className="space-y-1 text-sm" key={key}>{({ host: 'Serveri SMTP', username: 'Përdoruesi SMTP', password: 'Fjalëkalimi (bosh për ta ruajtur ekzistuesin)', from_address: 'Email dërgues', from_name: 'Emri dërgues' })[key]}<input className={input} required={!['username', 'password'].includes(key)} type={key === 'password' ? 'password' : key === 'from_address' ? 'email' : 'text'} value={smtp[key] ?? ''} onChange={event => setSmtp({ ...smtp, [key]: event.target.value })} autoComplete={key === 'password' ? 'new-password' : 'off'} /></label>)}
      <label className="space-y-1 text-sm">Porti<input className={input} type="number" min={1} max={65535} value={smtp.port} onChange={event => setSmtp({ ...smtp, port: Number(event.target.value) })} /></label>
      <label className="space-y-1 text-sm">Enkriptimi<select className={input} value={smtp.encryption} onChange={event => setSmtp({ ...smtp, encryption: event.target.value })}><option value="tls">STARTTLS</option><option value="ssl">TLS / SSL</option></select></label>
      <div className="sm:col-span-2"><button className={button} disabled={busy}><Save size={16} />Ruaj SMTP</button></div>
    </form>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void run(async () => { await request(base, token, '/smtp/test', { method: 'POST', body: JSON.stringify({ recipient }) }); setMessage('Email-i testues u dërgua.') }) }}><label className="space-y-1 text-sm">Email për test<input className={input} type="email" required value={recipient} onChange={event => setRecipient(event.target.value)} /></label><button className={button} disabled={busy}><Mail size={16} />Dërgo test</button></form>
    <form className="grid gap-3 border-y border-slate-200 py-6 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void run(async () => {
      await request(base, token, '/report-automations' + (editing ? '/' + editing : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...rule, recipients: rule.recipients.split(/[,;\n]/).map(value => value.trim()).filter(Boolean), next_run_at: new Date(rule.next_run_at).toISOString() }) })
      setRules((await request<{ data: Rule[] }>(base, token, '/report-automations')).data); setEditing(null); setRule(emptyRule()); setMessage('Automatizimi u ruajt.')
    }) }}>
      <h2 className="font-semibold sm:col-span-2">{editing ? 'Edito automatizimin' : 'Automatizim i ri'}</h2>
      <label className="space-y-1 text-sm">Emri<input className={input} required value={rule.name} onChange={event => setRule({ ...rule, name: event.target.value })} /></label>
      <label className="space-y-1 text-sm">Marrësit (me presje)<input className={input} required value={rule.recipients} onChange={event => setRule({ ...rule, recipients: event.target.value })} /></label>
      <label className="space-y-1 text-sm">Çdo sa minuta<input className={input} type="number" required min={15} max={525600} value={rule.interval_minutes} onChange={event => setRule({ ...rule, interval_minutes: Number(event.target.value) })} /></label>
      <label className="space-y-1 text-sm">Ditë në raport<input className={input} type="number" required min={1} max={366} value={rule.period_days} onChange={event => setRule({ ...rule, period_days: Number(event.target.value) })} /></label>
      <label className="space-y-1 text-sm">Dërgimi i ardhshëm<input className={input} type="datetime-local" required value={rule.next_run_at} onChange={event => setRule({ ...rule, next_run_at: event.target.value })} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={rule.enabled} onChange={event => setRule({ ...rule, enabled: event.target.checked })} />Aktiv</label>
      <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Raportet</legend><div className="flex flex-wrap gap-4">{Object.entries(types).map(([key, label]) => <label className="flex min-h-11 items-center gap-2 text-sm" key={key}><input type="checkbox" checked={rule.report_types.includes(key as ReportType)} onChange={event => setRule({ ...rule, report_types: event.target.checked ? [...rule.report_types, key as ReportType] : rule.report_types.filter(type => type !== key) })} />{label}</label>)}</div></fieldset>
      <fieldset><legend className="text-sm font-medium">Formatet</legend><div className="flex gap-4">{['xlsx', 'pdf'].map(format => <label className="flex min-h-11 items-center gap-2 text-sm" key={format}><input type="checkbox" checked={rule.formats.includes(format)} onChange={event => setRule({ ...rule, formats: event.target.checked ? [...rule.formats, format] : rule.formats.filter(value => value !== format) })} />{format.toUpperCase()}</label>)}</div></fieldset>
      <div className="flex gap-2 sm:col-span-2"><button className={button} disabled={busy || !rule.report_types.length || !rule.formats.length}><Save size={16} />Ruaj automatizimin</button><button className={button} type="button" onClick={() => { setEditing(null); setRule(emptyRule()) }}><Plus size={16} />I ri</button></div>
    </form>
    <div className="divide-y">{rules.map(item => <article className="flex flex-wrap items-center justify-between gap-3 py-4" key={item.id}><div><h3 className="font-medium">{item.name} · {item.enabled ? 'Aktiv' : 'Joaktiv'}</h3><p className="text-sm text-slate-500">{item.recipients.join(', ')} · {item.report_types.map(type => types[type]).join(', ')} · çdo {item.interval_minutes} minuta</p><p className="text-sm">Dërguar: {item.last_sent_at ? new Date(item.last_sent_at).toLocaleString('sq-AL') : '-'} · Radha: {new Date(item.next_run_at).toLocaleString('sq-AL')}</p>{item.last_error && <p className="text-sm text-rose-700">{item.last_error}</p>}</div><div className="flex gap-2"><button className={button} onClick={() => { setEditing(item.id); setRule({ ...item, recipients: item.recipients.join(', '), next_run_at: localTime(new Date(Math.max(Date.now() + 60000, new Date(item.next_run_at).getTime()))) }) }}><Pencil size={16} />Edito</button><button className={button} disabled={busy} onClick={() => { if (window.confirm('Fshi automatizimin?')) void run(async () => { await request(base, token, '/report-automations/' + item.id, { method: 'DELETE' }); setRules(rules.filter(rule => rule.id !== item.id)) }) }}><Trash2 size={16} />Fshi</button></div></article>)}</div>
  </section>
}
