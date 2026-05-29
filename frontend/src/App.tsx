import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import Chart from 'react-apexcharts'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleDollarSign,
  Download,
  LayoutDashboard,
  PackagePlus,
  ReceiptText,
  Repeat2,
  Search,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react'
import './index.css'

type InventoryItem = {
  imei: string
  product: string
  color: string
  storage: string
  cost: string
  price: string
  status: string
}

type NavItem = {
  label: string
  description: string
  icon: typeof LayoutDashboard
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Paneli', description: 'Pamje e pergjithshme e dyqanit' },
  { icon: Boxes, label: 'Inventari', description: 'Kerko, filtro dhe shto artikuj' },
  { icon: ReceiptText, label: 'Shitjet', description: 'Regjistro shitje normale' },
  { icon: Repeat2, label: 'Ndërrimet', description: 'Menaxho trade-in dhe diferenca pagese' },
  { icon: Banknote, label: 'Arka', description: 'Depozitime, terheqje dhe shpenzime' },
  { icon: Users, label: 'Përdoruesit', description: 'Rolet dhe stafi i dyqanit' },
  { icon: ShieldCheck, label: 'Historiku', description: 'Audit log per veprimet kryesore' },
]

const initialInventory: InventoryItem[] = [
  { imei: '356789102345671', product: 'Apple iPhone 15 Pro', color: 'Natyrale', storage: '256GB', cost: '€860', price: '€1,080', status: 'Në stok' },
  { imei: '359901881237443', product: 'Samsung Galaxy S24', color: 'E zezë', storage: '128GB', cost: '€520', price: '€720', status: 'Rezervuar' },
  { imei: '867442109875331', product: 'Xiaomi 14', color: 'E bardhë', storage: '512GB', cost: '€490', price: '€650', status: 'Në stok' },
  { imei: 'Nuk ka', product: 'Karikues i shpejtë USB-C', color: 'I zi', storage: '-', cost: '€9', price: '€19', status: 'Në stok' },
]

const transactions = [
  { type: 'Shitje normale', ref: 'iPhone 15 Pro 256GB', amount: '+€1,080', status: 'Shitur', tone: 'in' },
  { type: 'Ndërrim', ref: 'Galaxy S24 për iPhone 14', amount: '+€190', status: 'Pajisje e pranuar', tone: 'in' },
  { type: 'Shpenzim arke', ref: 'Stok xhamash mbrojtës', amount: '-€320', status: 'Shpenzim', tone: 'out' },
  { type: 'Depozitim manual', ref: 'Rregullim i gjendjes fillestare', amount: '+€500', status: 'Arkë', tone: 'in' },
]

const chartOptions = {
  chart: { toolbar: { show: false }, sparkline: { enabled: false }, fontFamily: 'Inter, system-ui, sans-serif' },
  dataLabels: { enabled: false },
  grid: { borderColor: '#e5e7eb', strokeDashArray: 4 },
  colors: ['#2563eb', '#16a34a'],
  stroke: { curve: 'smooth' as const, width: 3 },
  xaxis: { categories: ['Hën', 'Mar', 'Mër', 'Enj', 'Pre', 'Sht', 'Die'] },
  yaxis: { labels: { formatter: (value: number) => `€${Math.round(value / 1000)} mijë` } },
}

const emptyItem: InventoryItem = {
  imei: '',
  product: '',
  color: '',
  storage: '',
  cost: '',
  price: '',
  status: 'Në stok',
}

function App() {
  const [activeView, setActiveView] = useState('Paneli')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Të gjitha')
  const [inventory, setInventory] = useState(initialInventory)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draftItem, setDraftItem] = useState(emptyItem)
  const [notice, setNotice] = useState('Aplikacioni është gati.')

  const activeNav = navItems.find((item) => item.label === activeView) ?? navItems[0]
  const filteredInventory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return inventory.filter((item) => {
      const matchesSearch = [item.imei, item.product, item.color, item.storage]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch)
      const matchesStatus = statusFilter === 'Të gjitha' || item.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [inventory, search, statusFilter])

  const stockValue = inventory.reduce((total, item) => total + parseCurrency(item.cost), 0)
  const stockCount = inventory.filter((item) => item.status === 'Në stok').length

  const metrics = [
    { label: 'Vlera e stokut', value: formatEuro(stockValue), delta: '+8.4%', icon: Boxes },
    { label: 'Produkte në stok', value: stockCount.toString(), delta: `+${inventory.length}`, icon: PackagePlus },
    { label: 'Shitjet sot', value: '€7,890', delta: '+12.1%', icon: ReceiptText },
    { label: 'Gjendja e arkës', value: '€22,640', delta: '-€420', icon: Banknote },
  ]

  function openNewItemModal() {
    setDraftItem(emptyItem)
    setIsModalOpen(true)
  }

  function saveNewItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!draftItem.product.trim() || !draftItem.price.trim()) {
      setNotice('Plotëso së paku produktin dhe çmimin.')
      return
    }

    setInventory((items) => [{ ...draftItem, imei: draftItem.imei || 'Nuk ka' }, ...items])
    setIsModalOpen(false)
    setNotice(`Artikulli "${draftItem.product}" u shtua në inventar.`)
    setActiveView('Inventari')
  }

  function exportInventory() {
    const header = ['IMEI', 'Produkti', 'Ngjyra', 'Memoria', 'Kosto', 'Çmimi', 'Statusi']
    const rows = filteredInventory.map((item) => [item.imei, item.product, item.color, item.storage, item.cost, item.price, item.status])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventari-stoku.csv'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Inventari u eksportua si CSV.')
  }

  function quickAction(action: string) {
    setNotice(`${action} është gati për lidhje me API në hapin tjetër.`)
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex size-9 items-center justify-center rounded-md bg-blue-600 text-white">
            <Store size={19} />
          </div>
          <div>
            <p className="text-sm font-semibold">Stoku</p>
            <p className="text-xs text-slate-500">Menaxhim për dyqane telefoni</p>
          </div>
        </div>
        <nav className="space-y-1 p-3 text-sm">
          {navItems.map((item) => (
            <button
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${activeView === item.label ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`}
              key={item.label}
              onClick={() => {
                setActiveView(item.label)
                setNotice(`${item.label}: ${item.description}.`)
              }}
              type="button"
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold">{activeView === 'Paneli' ? 'Dyqani Qendror' : activeView}</h1>
                <p className="text-sm text-slate-500">{activeNav.description}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 sm:w-56"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Kërko IMEI ose model"
                    value={search}
                  />
                </label>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" onClick={openNewItemModal} type="button">
                  <PackagePlus size={17} />
                  Artikull i ri
                </button>
              </div>
            </div>
            <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>
          </div>
        </header>

        <div className="space-y-6 p-4 lg:p-6">
          {activeView === 'Paneli' && (
            <>
              <Metrics metrics={metrics} />
              <DashboardCharts />
              <InventoryTable
                filteredInventory={filteredInventory}
                onExport={exportInventory}
                search={search}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />
            </>
          )}

          {activeView === 'Inventari' && (
            <InventoryTable
              filteredInventory={filteredInventory}
              onExport={exportInventory}
              search={search}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
            />
          )}

          {activeView !== 'Paneli' && activeView !== 'Inventari' && (
            <WorkView title={activeView} onPrimaryAction={quickAction} />
          )}
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4">
          <form className="w-full max-w-2xl rounded-md bg-white shadow-xl" onSubmit={saveNewItem}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold">Shto artikull të ri</h2>
              <button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setIsModalOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              {[
                ['imei', 'IMEI'],
                ['product', 'Produkti'],
                ['color', 'Ngjyra'],
                ['storage', 'Memoria'],
                ['cost', 'Kosto'],
                ['price', 'Çmimi'],
              ].map(([key, label]) => (
                <label className="space-y-1 text-sm" key={key}>
                  <span className="font-medium text-slate-700">{label}</span>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600"
                    onChange={(event) => setDraftItem((item) => ({ ...item, [key]: event.target.value }))}
                    value={draftItem[key as keyof InventoryItem]}
                  />
                </label>
              ))}
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Statusi</span>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600"
                  onChange={(event) => setDraftItem((item) => ({ ...item, status: event.target.value }))}
                  value={draftItem.status}
                >
                  <option>Në stok</option>
                  <option>Rezervuar</option>
                  <option>Shitur</option>
                  <option>Dëmtuar</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={() => setIsModalOpen(false)} type="button">
                Anulo
              </button>
              <button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">
                Ruaj artikullin
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function Metrics({ metrics }: { metrics: Array<{ label: string; value: string; delta: string; icon: typeof Boxes }> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={metric.label}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{metric.label}</p>
            <metric.icon className="text-slate-400" size={18} />
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <strong className="text-2xl font-semibold">{metric.value}</strong>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{metric.delta}</span>
          </div>
        </article>
      ))}
    </section>
  )
}

function DashboardCharts() {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Trendi i shitjeve dhe fitimit</h2>
            <p className="text-sm text-slate-500">Të ardhurat ditore krahasuar me fitimin e realizuar</p>
          </div>
          <CircleDollarSign className="text-slate-400" size={20} />
        </div>
        <Chart
          height={304}
          options={chartOptions}
          series={[
            { name: 'Të ardhurat', data: [8200, 6700, 9100, 7400, 10200, 12800, 7890] },
            { name: 'Fitimi', data: [2100, 1800, 2700, 2200, 3100, 3900, 2400] },
          ]}
          type="area"
        />
      </article>

      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Transaksionet e fundit</h2>
        <div className="mt-4 space-y-3">
          {transactions.map((transaction) => (
            <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3" key={transaction.ref}>
              <div className="flex items-center gap-3">
                <div className={`flex size-9 items-center justify-center rounded-md ${transaction.tone === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {transaction.tone === 'in' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                </div>
                <div>
                  <p className="text-sm font-medium">{transaction.type}</p>
                  <p className="text-xs text-slate-500">{transaction.ref}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{transaction.amount}</p>
                <p className="text-xs text-slate-500">{transaction.status}</p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

function InventoryTable({
  filteredInventory,
  onExport,
  search,
  setStatusFilter,
  statusFilter,
}: {
  filteredInventory: InventoryItem[]
  onExport: () => void
  search: string
  setStatusFilter: (status: string) => void
  statusFilter: string
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Pamje e inventarit</h2>
          <p className="text-sm text-slate-500">
            {filteredInventory.length} artikuj {search ? `për kërkimin "${search}"` : 'të shfaqur'}
          </p>
        </div>
        <div className="flex gap-2">
          <select className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-600" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option>Të gjitha</option>
            <option>Në stok</option>
            <option>Rezervuar</option>
            <option>Shitur</option>
            <option>Dëmtuar</option>
          </select>
          <button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={onExport} type="button">
            <Download size={16} />
            Eksporto
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">IMEI</th>
              <th className="px-4 py-3 font-medium">Produkti</th>
              <th className="px-4 py-3 font-medium">Ngjyra</th>
              <th className="px-4 py-3 font-medium">Memoria</th>
              <th className="px-4 py-3 font-medium">Kosto</th>
              <th className="px-4 py-3 font-medium">Çmimi</th>
              <th className="px-4 py-3 font-medium">Statusi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredInventory.map((item) => (
              <tr className="hover:bg-slate-50" key={`${item.imei}-${item.product}`}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.imei}</td>
                <td className="px-4 py-3 font-medium">{item.product}</td>
                <td className="px-4 py-3">{item.color}</td>
                <td className="px-4 py-3">{item.storage}</td>
                <td className="px-4 py-3">{item.cost}</td>
                <td className="px-4 py-3 font-semibold">{item.price}</td>
                <td className="px-4 py-3">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{item.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function WorkView({ onPrimaryAction, title }: { onPrimaryAction: (action: string) => void; title: string }) {
  const actions: Record<string, string[]> = {
    Shitjet: ['Regjistro shitje', 'Shiko faturat', 'Raport ditor'],
    Ndërrimet: ['Regjistro ndërrim', 'Llogarit diferencën', 'Historiku i ndërrimeve'],
    Arka: ['Depozitim', 'Tërheqje', 'Shpenzim'],
    Përdoruesit: ['Shto përdorues', 'Ndrysho rol', 'Çaktivizo qasje'],
    Historiku: ['Filtro log-et', 'Eksporto audit', 'Shiko hyrjet'],
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">Këto komanda tani reagojnë në UI. Lidhja direkte me backend API është hapi tjetër.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(actions[title] ?? ['Hap pamjen', 'Filtro', 'Eksporto']).map((action) => (
          <button className="rounded-md border border-slate-300 px-3 py-3 text-left text-sm font-medium hover:border-blue-500 hover:bg-blue-50" key={action} onClick={() => onPrimaryAction(action)} type="button">
            {action}
          </button>
        ))}
      </div>
    </section>
  )
}

function parseCurrency(value: string) {
  return Number(value.replace(/[^\d.-]/g, '')) || 0
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('de-DE', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

export default App
