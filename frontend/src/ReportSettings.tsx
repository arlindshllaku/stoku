import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, Clock3, FileSpreadsheet, FileText, LoaderCircle, Mail, MoreHorizontal, Pencil, Plus, Save, Settings2, ShieldCheck, Trash2, X } from 'lucide-react'

type Props = { base: string; token: string }
const types = { sales: 'Shitjet', exchanges: 'Ndërrimet', purchases: 'Blerjet', inventory: 'Lëvizjet e inventarit', stock: 'Stoku aktual' }
type ReportType = keyof typeof types
type Rule = { id: number; name: string; recipients: string[]; report_types: ReportType[]; formats: string[]; interval_minutes: number; period_days: number; enabled: boolean; next_run_at: string; last_sent_at: string | null; last_error: string | null }
const localTime = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const emptyRule = () => ({ name: '', recipients: '', report_types: ['stock'] as ReportType[], formats: ['xlsx', 'pdf'], interval_minutes: 1440, period_days: 1, enabled: true, next_run_at: localTime(new Date(Date.now() + 3600000)) })
const emptySmtp = { host: '', port: 587, encryption: 'tls', username: '', password: '', from_address: '', from_name: 'Stoku' }
type Smtp = typeof emptySmtp
type SmtpResponse = { settings: Smtp | null; has_password?: boolean }
const dateLabel = (value: string | null) => {
  if (!value) return 'Ende pa dërgim'
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const intervalLabel = (minutes: number) => minutes % 1440 === 0 ? `Çdo ${minutes / 1440} ditë` : minutes % 60 === 0 ? `Çdo ${minutes / 60} orë` : `Çdo ${minutes} minuta`
const input = 'ui-input'
const button = 'ui-button'
const primaryButton = 'ui-button ui-button-primary'

async function request<T>(base: string, token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(base + path, { ...init, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(Object.values(error.errors ?? {}).flat().join(' ') || error.message || 'Kërkesa dështoi.')
  }
  return response.status === 204 ? undefined as T : response.json()
}

function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const Icon = error ? AlertCircle : CheckCircle2
  return <div className={`ui-notice ${error ? 'ui-notice-error' : 'ui-notice-success'}`} role={error ? 'alert' : 'status'}><Icon size={18} /><div>{children}</div></div>
}

function Drawer({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow }
  }, [])
  return <dialog ref={ref} className="ui-drawer" aria-labelledby="automation-editor-title" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="ui-drawer-heading"><div><p className="ui-eyebrow">Dërgimi i raporteve</p><h2 id="automation-editor-title">{title}</h2><p className="ui-hint">Zgjidhni çfarë dërgohet, kujt dhe kur.</p></div><button className="ui-icon-button" disabled={busy} onClick={onClose} aria-label="Mbyll redaktimin"><X size={20} /></button></div>
    {children}
  </dialog>
}

export function ReportSettings({ base, token }: Props) {
  const [smtp, setSmtp] = useState(emptySmtp)
  const [savedSmtp, setSavedSmtp] = useState<Smtp | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [smtpFormOpen, setSmtpFormOpen] = useState(false)
  const [rules, setRules] = useState<Rule[]>([])
  const [rule, setRule] = useState(emptyRule)
  const [editing, setEditing] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [section, setSection] = useState<'automations' | 'email'>('automations')
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [messageError, setMessageError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const editorBaseline = useRef('')
  useEffect(() => {
    const controller = new AbortController()
    void Promise.all([
      request<SmtpResponse>(base, token, '/smtp', { signal: controller.signal }),
      request<{ data: Rule[] }>(base, token, '/report-automations', { signal: controller.signal }),
    ]).then(([settings, result]) => {
      setSmtp({ ...emptySmtp, ...settings.settings, password: '' }); setSavedSmtp(settings.settings); setHasPassword(Boolean(settings.has_password)); setRules(result.data)
    }).catch(error => { if (error.name !== 'AbortError') { setMessageError(true); setMessage(error.message) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [base, token])
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage(''); setMessageError(false)
    try { await action() } catch (error) { setMessageError(true); setMessage(error instanceof Error ? error.message : 'Veprimi dështoi.') } finally { setBusy(false) }
  }
  function newRule() { const draft = emptyRule(); editorBaseline.current = JSON.stringify(draft); setEditing(null); setRule(draft); setEditorOpen(true) }
  function handleEditRule(item: Rule, clickedAt: number) {
    const draft = { ...item, recipients: item.recipients.join(', '), next_run_at: localTime(new Date(Math.max(clickedAt + 60000, new Date(item.next_run_at).getTime()))) }
    editorBaseline.current = JSON.stringify(draft); setEditing(item.id); setRule(draft); setEditorOpen(true)
  }
  function handleCloseEditor() { if (!busy && (JSON.stringify(rule) === editorBaseline.current || window.confirm('Ndryshimet nuk janë ruajtur. Dëshironi ta mbyllni?'))) setEditorOpen(false) }
  const activeRules = rules.filter(item => item.enabled).length
  const failedRules = rules.filter(item => item.last_error).length
  return <section className="settings-workspace" aria-label="Cilësimet e raporteve">
    <div className="workspace-heading"><div><p className="ui-eyebrow">Raportet me email</p><h2>Dërgimi automatik</h2><p className="ui-hint">Raportet e dyqanit, sipas orarit që zgjidhni.</p></div>{section === 'automations' && <button className={primaryButton} disabled={busy || loading} onClick={newRule}><Plus size={18} />Automatizim i ri</button>}</div>
    <nav className="ui-section-nav" aria-label="Seksionet e cilësimeve"><button aria-current={section === 'automations' ? 'page' : undefined} onClick={() => setSection('automations')}><CalendarClock size={17} />Automatizimet<span>{rules.length}</span></button><button aria-current={section === 'email' ? 'page' : undefined} onClick={() => setSection('email')}><Mail size={17} />Email i dyqanit</button></nav>
    {message && <Notice error={messageError}>{message}</Notice>}
    {loading ? <div className="ui-card ui-loading" role="status"><LoaderCircle className="ui-spin" size={22} />Duke ngarkuar cilësimet…</div> : section === 'automations' ? <>
      <div className="automation-overview"><span><span className="ui-status-dot ui-status-dot-success" />{activeRules} aktive</span><span>{rules.length - activeRules} joaktive</span><span className={failedRules ? 'ui-text-danger' : ''}><AlertCircle size={15} />{failedRules} me gabim në dërgim</span></div>
      <div className="ui-card automation-list">
        <div className="automation-list-heading"><h3>Automatizimet tuaja</h3><span className="ui-hint">{rules.length} gjithsej</span></div>
        {!rules.length ? <div className="ui-empty"><div className="ui-empty-icon"><CalendarClock size={27} /></div><h3>Raportet mund të vijnë vetë</h3><p>Krijoni një automatizim dhe zgjidhni raportet, marrësit dhe orarin.</p><button className={primaryButton} disabled={busy} onClick={newRule}><Plus size={17} />Automatizim i ri</button></div> : rules.map(item => <article className="automation-row" key={item.id}>
          <div className="automation-identity"><div className="automation-icon"><FileText size={21} /></div><div className="automation-main"><div className="automation-title"><h4>{item.name}</h4><span className={`ui-badge ${item.enabled ? 'ui-badge-blue' : 'ui-badge-neutral'}`}><span className="ui-status-dot" />{item.enabled ? 'Orari aktiv' : 'Orari joaktiv'}</span></div><p className="automation-recipients"><Mail size={14} /><span>{item.recipients.join(', ')}</span></p><div className="automation-report-types"><span>{item.report_types.map(type => types[type]).join(' · ')}</span>{item.formats.map(format => <span className="ui-format-tag" key={format}>{format.toUpperCase()}</span>)}</div></div></div>
          <div className="automation-schedule"><span className="ui-hint"><Clock3 size={14} />{intervalLabel(item.interval_minutes)}</span><strong>{dateLabel(item.next_run_at)}</strong><span className="ui-hint">{item.enabled ? 'Dërgimi i ardhshëm' : 'Orari i ruajtur'}</span></div>
          <div className="automation-delivery"><span className={`ui-badge ${item.last_error ? 'ui-badge-error' : item.last_sent_at ? 'ui-badge-success' : 'ui-badge-neutral'}`}>{item.last_error ? <AlertCircle size={14} /> : item.last_sent_at ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{item.last_error ? 'Dërgimi dështoi' : item.last_sent_at ? 'Dërguar me sukses' : 'Në pritje'}</span><span className="ui-hint">{dateLabel(item.last_sent_at)}</span></div>
          <div className="automation-actions"><button className={button} disabled={busy} onClick={() => handleEditRule(item, Date.now())} aria-label={`Edito ${item.name}`}><Pencil size={15} /><span>Edito</span></button><details className="ui-action-menu"><summary className="ui-icon-button" aria-label={`Veprime për ${item.name}`}><MoreHorizontal size={19} /></summary><div><button className="ui-menu-danger" disabled={busy} onClick={() => { if (window.confirm('Fshi automatizimin?')) void run(async () => { await request(base, token, '/report-automations/' + item.id, { method: 'DELETE' }); setRules(rules.filter(rule => rule.id !== item.id)) }) }}><Trash2 size={16} />Fshi automatizimin</button></div></details></div>
          {item.last_error && <div className="automation-error"><AlertCircle size={16} /><div><strong>Dërgimi i fundit kërkon vëmendje</strong><p>{item.last_error}</p></div><button className="ui-text-button" disabled={busy} onClick={() => handleEditRule(item, Date.now())}>Shiko cilësimet<ArrowRight size={15} /></button></div>}
        </article>)}
      </div>
      <div className="settings-email-shortcut"><div className="inline-flex items-center gap-3"><Mail size={18} /><p><strong>Email i dyqanit</strong><span>{savedSmtp?.from_address || 'Konfiguroni dërguesin e raporteve.'}</span></p></div><button className="ui-text-button" onClick={() => setSection('email')}>Hap cilësimet<ArrowRight size={16} /></button></div>
    </> : <div className="email-settings-layout">
      <section className="ui-card email-settings-card" aria-labelledby="email-settings-title"><div className="email-card-heading"><div className="ui-empty-icon"><Mail size={23} /></div><div><h3 id="email-settings-title">Email i dyqanit</h3><p className="ui-hint">Llogaria që dërgon raportet tuaja.</p></div><span className={`ui-badge ${savedSmtp ? 'ui-badge-success' : 'ui-badge-neutral'}`}>{savedSmtp ? <CheckCircle2 size={14} /> : <Settings2 size={14} />}{savedSmtp ? 'I konfiguruar' : 'Pa konfigurim'}</span></div>
        {!smtpFormOpen && savedSmtp ? <><dl className="smtp-summary"><div><dt>Dërguesi</dt><dd>{savedSmtp.from_name}<span>{savedSmtp.from_address}</span></dd></div><div><dt>Serveri</dt><dd>{savedSmtp.host}<span>Porti {savedSmtp.port} · {savedSmtp.encryption === 'tls' ? 'STARTTLS' : 'TLS / SSL'}</span></dd></div></dl><div className="smtp-summary-footer"><p className="ui-hint"><ShieldCheck size={16} />Fjalëkalimi nuk shfaqet.</p><button className={button} disabled={busy} onClick={() => setSmtpFormOpen(true)}><Pencil size={15} />Ndrysho cilësimet</button></div></> : <form onSubmit={event => { event.preventDefault(); void run(async () => { const result = await request<SmtpResponse>(base, token, '/smtp', { method: 'PUT', body: JSON.stringify(smtp) }); setSmtp({ ...smtp, password: '' }); setSavedSmtp(result.settings); setHasPassword(Boolean(result.has_password)); setSmtpFormOpen(false); setMessage('SMTP u ruajt.') }) }}>
          <fieldset disabled={busy} className="smtp-form-grid">
            {(['host', 'username', 'password', 'from_address', 'from_name'] as const).map(key => <label className={`ui-field ${key === 'password' ? 'smtp-password-field' : ''}`} key={key}>{({ host: 'Serveri SMTP', username: 'Përdoruesi SMTP', password: 'Fjalëkalimi SMTP', from_address: 'Email dërgues', from_name: 'Emri dërgues' })[key]}<input className={input} required={!['username', 'password'].includes(key)} type={key === 'password' ? 'password' : key === 'from_address' ? 'email' : 'text'} value={smtp[key] ?? ''} onChange={event => setSmtp({ ...smtp, [key]: event.target.value })} autoComplete={key === 'password' ? 'new-password' : 'off'} />{key === 'password' && <span className="ui-field-hint">{hasPassword ? 'Lëreni bosh për ta ruajtur fjalëkalimin ekzistues.' : 'Vendosni fjalëkalimin për llogarinë e dërgimit.'}</span>}</label>)}
            <label className="ui-field">Porti<input className={input} type="number" min={1} max={65535} value={smtp.port} onChange={event => setSmtp({ ...smtp, port: Number(event.target.value) })} /></label><label className="ui-field">Enkriptimi<select className={input} value={smtp.encryption} onChange={event => setSmtp({ ...smtp, encryption: event.target.value })}><option value="tls">STARTTLS</option><option value="ssl">TLS / SSL</option></select></label>
          </fieldset><div className="ui-form-footer"><button className={primaryButton} disabled={busy}>{busy ? <LoaderCircle className="ui-spin" size={16} /> : <Save size={16} />}Ruaj SMTP</button>{savedSmtp && <button className={button} type="button" disabled={busy} onClick={() => { setSmtp({ ...emptySmtp, ...savedSmtp, password: '' }); setSmtpFormOpen(false) }}>Anulo</button>}</div>
        </form>}
      </section>
      <aside className="ui-card email-test-card"><div className="ui-empty-icon"><CheckCircle2 size={22} /></div><h3>Kontrolloni dërgimin</h3><p className="ui-hint">Dërgoni një email testues me konfigurimin e ruajtur. Emaili i testit nuk përmban raport.</p><form onSubmit={event => { event.preventDefault(); void run(async () => { await request(base, token, '/smtp/test', { method: 'POST', body: JSON.stringify({ recipient }) }); setMessage('Email-i testues u dërgua.') }) }}><label className="ui-field">Email për test<input className={input} type="email" required value={recipient} onChange={event => setRecipient(event.target.value)} placeholder="email@shembull.com" /></label><button className={button} disabled={busy || !savedSmtp}>{busy ? <LoaderCircle className="ui-spin" size={16} /> : <Mail size={16} />}Dërgo test</button></form>{!savedSmtp && <p className="ui-field-hint">Ruani fillimisht cilësimet e dërgimit.</p>}</aside>
    </div>}
    {editorOpen && <Drawer title={editing ? 'Edito automatizimin' : 'Automatizim i ri'} onClose={handleCloseEditor} busy={busy}>
      <form className="ui-drawer-form" onSubmit={event => { event.preventDefault(); void run(async () => {
        await request(base, token, '/report-automations' + (editing ? '/' + editing : ''), { method: editing ? 'PUT' : 'POST', body: JSON.stringify({ ...rule, recipients: rule.recipients.split(/[,;\n]/).map(value => value.trim()).filter(Boolean), next_run_at: new Date(rule.next_run_at).toISOString() }) })
        setRules((await request<{ data: Rule[] }>(base, token, '/report-automations')).data); setEditing(null); setRule(emptyRule()); setEditorOpen(false); setMessage('Automatizimi u ruajt.')
      }) }}>{message && messageError && <div className="ui-drawer-notice"><Notice error>{message}</Notice></div>}<div className="ui-drawer-body"><fieldset disabled={busy} className="automation-editor-fields">
        <section className="editor-section"><h3><span>1</span>Emri dhe marrësit</h3><label className="ui-field">Emri<input className={input} required value={rule.name} onChange={event => setRule({ ...rule, name: event.target.value })} placeholder="P.sh. Raporti ditor i stokut" /></label><label className="ui-field">Marrësit<input className={input} required value={rule.recipients} onChange={event => setRule({ ...rule, recipients: event.target.value })} placeholder="email@shembull.com" /><span className="ui-field-hint">Ndani disa adresa me presje.</span></label></section>
        <section className="editor-section"><h3><span>2</span>Raportet dhe formatet</h3><fieldset><legend className="ui-sr-only">Raportet</legend><div className="ui-selection-grid">{Object.entries(types).map(([key, label]) => <label className={`ui-selection ${rule.report_types.includes(key as ReportType) ? 'is-selected' : ''}`} key={key}><input type="checkbox" checked={rule.report_types.includes(key as ReportType)} onChange={event => setRule({ ...rule, report_types: event.target.checked ? [...rule.report_types, key as ReportType] : rule.report_types.filter(type => type !== key) })} /><span>{label}</span></label>)}</div></fieldset><fieldset><legend className="ui-field-legend">Formatet</legend><div className="ui-format-options">{['xlsx', 'pdf'].map(format => <label className={`ui-selection ${rule.formats.includes(format) ? 'is-selected' : ''}`} key={format}><input type="checkbox" checked={rule.formats.includes(format)} onChange={event => setRule({ ...rule, formats: event.target.checked ? [...rule.formats, format] : rule.formats.filter(value => value !== format) })} />{format === 'pdf' ? <FileText size={17} /> : <FileSpreadsheet size={17} />}<span>{format.toUpperCase()}</span></label>)}</div></fieldset></section>
        <section className="editor-section"><h3><span>3</span>Orari i dërgimit</h3><div className="editor-number-fields"><label className="ui-field">Çdo sa minuta<input className={input} type="number" required min={15} max={525600} value={rule.interval_minutes} onChange={event => setRule({ ...rule, interval_minutes: Number(event.target.value) })} /></label><label className="ui-field">Ditë në raport<input className={input} type="number" required min={1} max={366} value={rule.period_days} onChange={event => setRule({ ...rule, period_days: Number(event.target.value) })} /></label></div><label className="ui-field">Dërgimi i ardhshëm<input className={input} type="datetime-local" required value={rule.next_run_at} onChange={event => setRule({ ...rule, next_run_at: event.target.value })} /></label><label className="ui-enabled-setting"><div><strong>Orari aktiv</strong><p className="ui-hint">Dërgo raportet sipas këtij orari.</p></div><input type="checkbox" checked={rule.enabled} onChange={event => setRule({ ...rule, enabled: event.target.checked })} aria-label="Orari aktiv" /></label></section>
      </fieldset></div><div className="ui-drawer-footer"><button className={button} disabled={busy} type="button" onClick={handleCloseEditor}>Anulo</button><button className={primaryButton} disabled={busy || !rule.report_types.length || !rule.formats.length}>{busy ? <LoaderCircle className="ui-spin" size={17} /> : <Save size={17} />}Ruaj automatizimin</button></div></form>
    </Drawer>}
  </section>
}
