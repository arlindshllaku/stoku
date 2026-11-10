import { Plus, Trash2 } from 'lucide-react'

import { emptyPhone } from './phoneForm'
import type { IncomingPhone } from './phoneForm'

export function IncomingPhones({ phones, onChange }: { phones: IncomingPhone[]; onChange: (phones: IncomingPhone[]) => void }) {
  const fields: [keyof IncomingPhone, string, boolean][] = [
    ['brand', 'Brendi', true], ['model', 'Modeli', true], ['imei', 'IMEI', false],
    ['color', 'Ngjyra', false], ['storage', 'Memoria', false],
    ['purchase_price', 'Vlera e pranimit EUR', false], ['selling_price', 'Çmimi i shitjes EUR', false],
  ]
  return <div className="space-y-4 sm:col-span-2">
    {phones.map((phone, index) => <fieldset className="border-b border-slate-200 pb-4" key={phone.id ?? index}>
      <legend className="mb-3 text-sm font-semibold">Telefoni hyrës {index + 1}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label, required]) => <label className="space-y-1 text-sm" key={key}>
        <span>{label}</span><input className="h-11 w-full rounded-md border border-slate-300 px-3" required={required} type={key.includes('price') ? 'number' : 'text'} min={key.includes('price') ? 0 : undefined} step={key.includes('price') ? '0.01' : undefined} value={phone[key] ?? ''} onChange={event => onChange(phones.map((item, i) => i === index ? { ...item, [key]: event.target.value } : item))} />
      </label>)}</div>
      {!phone.id && phones.length > 1 && <button className="mt-3 inline-flex h-11 items-center gap-2 px-3 text-sm text-rose-700" type="button" onClick={() => onChange(phones.filter((_, i) => i !== index))}><Trash2 size={16} />Hiq telefonin</button>}
    </fieldset>)}
    <button className="inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm" type="button" disabled={phones.length >= 100} onClick={() => onChange([...phones, emptyPhone()])}><Plus size={16} />Shto telefon hyrës</button>
  </div>
}
