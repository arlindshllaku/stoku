import { useEffect, useMemo, useState } from 'react'
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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

type StoreRecord = { id: number; name: string }
type InventoryApiItem = {
  id: number
  imei: string | null
  brand: string
  model: string
  color: string | null
  storage: string | null
  purchase_price: string
  selling_price: string
  status: string
}
type StoreUser = { id: number; name: string; email: string; status: string }
type CashTransaction = { id: number; type: string; amount: string; direction: string; created_at: string }
type CashState = { register?: { current_balance: string }; transactions?: { data: CashTransaction[] } }
type ModalMode = 'inventory' | 'user' | 'cash' | 'sale' | null

const navItems = [
  { icon: LayoutDashboard, label: 'Paneli', description: 'Pamje e përgjithshme e dyqanit' },
  { icon: Boxes, label: 'Inventari', description: 'Kërko, filtro dhe shto artikuj' },
  { icon: ReceiptText, label: 'Shitjet', description: 'Regjistro shitje normale' },
  { icon: Repeat2, label: 'Ndërrimet', description: 'Menaxho trade-in dhe diferenca pagese' },
  { icon: Banknote, label: 'Arka', description: 'Depozitime, tërheqje dhe shpenzime' },
  { icon: Users, label: 'Përdoruesit', description: 'Rolet dhe stafi i dyqanit' },
  { icon: ShieldCheck, label: 'Historiku', description: 'Historiku i veprimeve kryesore' },
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

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('stoku_token') ?? '')
  const [activeView, setActiveView] = useState('Paneli')
  const [stores, setStores] = useState<StoreRecord[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null)
  const [inventory, setInventory] = useState<InventoryApiItem[]>([])
  const [users, setUsers] = useState<StoreUser[]>([])
  const [cash, setCash] = useState<CashState>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Të gjitha')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [notice, setNotice] = useState('Kyçu për të nisur punën.')
  const [isLoading, setIsLoading] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [inventoryForm, setInventoryForm] = useState({ brand: '', model: '', imei: '', color: '', storage: '', purchase_price: '', selling_price: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'employee' })
  const [cashForm, setCashForm] = useState({ type: 'deposit', amount: '', notes: '' })
  const [saleForm, setSaleForm] = useState({ inventory_item_id: '', selling_price: '' })

  const activeNav = navItems.find((item) => item.label === activeView) ?? navItems[0]
  const selectedStore = stores.find((store) => store.id === selectedStoreId)

  const filteredInventory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return inventory.filter((item) => {
      const text = [item.imei ?? 'Nuk ka', item.brand, item.model, item.color ?? '', item.storage ?? ''].join(' ').toLowerCase()
      const matchesSearch = text.includes(normalizedSearch)
      const matchesStatus = statusFilter === 'Të gjitha' || statusLabel(item.status) === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [inventory, search, statusFilter])

  const stockValue = inventory.reduce((total, item) => total + Number(item.purchase_price), 0)
  const stockCount = inventory.filter((item) => item.status === 'in_stock').length
  const activeStorePath = selectedStoreId ? `/stores/${selectedStoreId}` : ''

  useEffect(() => {
    if (token) {
      void loadStores(token)
    }
  }, [token])

  useEffect(() => {
    if (token && selectedStoreId) {
      void loadStoreData()
    }
  }, [selectedStoreId, token])

  async function api<T>(path: string, options: RequestInit = {}, authToken = token): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message ?? 'Kërkesa dështoi.')
    }

    return response.json()
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    try {
      const result = await api<{ token: string }>('/auth/login', {
        body: JSON.stringify({ ...loginForm, device_name: 'stoku-web' }),
        method: 'POST',
      }, '')
      localStorage.setItem('stoku_token', result.token)
      setToken(result.token)
      setNotice('Kyçja u krye me sukses.')
      await loadStores(result.token)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Kyçja dështoi.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadStores(authToken = token) {
    const result = await api<{ data: StoreRecord[] }>('/stores', {}, authToken)
    setStores(result.data)
    setSelectedStoreId((current) => current ?? result.data[0]?.id ?? null)
    setNotice(result.data.length ? 'Të dhënat u ngarkuan nga backend.' : 'Nuk ka dyqan të krijuar. Ekzekuto db:seed ose krijo dyqan.')
  }

  async function loadStoreData() {
    setIsLoading(true)
    try {
      const [inventoryResult, usersResult, cashResult] = await Promise.all([
        api<{ data: Array<InventoryApiItem> }>(`${activeStorePath}/inventory?per_page=100`),
        api<{ data: Array<StoreUser> }>(`${activeStorePath}/users`),
        api<CashState>(`${activeStorePath}/cash`),
      ])
      setInventory(inventoryResult.data)
      setUsers(usersResult.data)
      setCash(cashResult)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i të dhënave dështoi.')
    } finally {
      setIsLoading(false)
    }
  }

  async function createInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/inventory`, {
        body: JSON.stringify({
          ...inventoryForm,
          purchase_price: Number(inventoryForm.purchase_price),
          selling_price: Number(inventoryForm.selling_price),
          status: 'in_stock',
        }),
        method: 'POST',
      })
      setModalMode(null)
      setInventoryForm({ brand: '', model: '', imei: '', color: '', storage: '', purchase_price: '', selling_price: '' })
      setNotice('Artikulli u ruajt në backend.')
      await loadStoreData()
      setActiveView('Inventari')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ruajtja e artikullit dështoi.')
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/users`, { body: JSON.stringify(userForm), method: 'POST' })
      setModalMode(null)
      setUserForm({ name: '', email: '', password: '', role: 'employee' })
      setNotice('Përdoruesi u krijua dhe u lidh me dyqanin.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Krijimi i përdoruesit dështoi.')
    }
  }

  async function createCashTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    const endpoint = cashForm.type === 'deposit' ? 'deposit' : cashForm.type === 'withdraw' ? 'withdraw' : 'expense'
    try {
      await api(`${activeStorePath}/cash/${endpoint}`, {
        body: JSON.stringify({ amount: Number(cashForm.amount), notes: cashForm.notes || 'Regjistruar nga paneli' }),
        method: 'POST',
      })
      setModalMode(null)
      setCashForm({ type: 'deposit', amount: '', notes: '' })
      setNotice('Lëvizja e arkës u regjistrua në backend.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi në arkë dështoi.')
    }
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/sales/normal`, {
        body: JSON.stringify({
          inventory_item_id: Number(saleForm.inventory_item_id),
          payment_method: 'cash',
          selling_price: saleForm.selling_price ? Number(saleForm.selling_price) : undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      setSaleForm({ inventory_item_id: '', selling_price: '' })
      setNotice('Shitja u regjistrua në backend.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi i shitjes dështoi.')
    }
  }

  function logout() {
    localStorage.removeItem('stoku_token')
    setToken('')
    setStores([])
    setInventory([])
    setUsers([])
    setNotice('Dolët nga sistemi.')
  }

  function exportInventory() {
    const header = ['IMEI', 'Produkti', 'Ngjyra', 'Memoria', 'Kosto', 'Çmimi', 'Statusi']
    const rows = filteredInventory.map((item) => [item.imei ?? 'Nuk ka', `${item.brand} ${item.model}`, item.color ?? '', item.storage ?? '', item.purchase_price, item.selling_price, statusLabel(item.status)])
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'inventari-stoku.csv'
    link.click()
    URL.revokeObjectURL(url)
    setNotice('Inventari u eksportua si CSV.')
  }

  if (!token) {
    return <LoginScreen form={loginForm} isLoading={isLoading} onChange={setLoginForm} onSubmit={login} notice={notice} />
  }

  const metrics = [
    { label: 'Vlera e stokut', value: formatEuro(stockValue), delta: `${inventory.length} artikuj`, icon: Boxes },
    { label: 'Produkte në stok', value: stockCount.toString(), delta: 'Aktive', icon: PackagePlus },
    { label: 'Përdorues', value: users.length.toString(), delta: 'Stafi', icon: Users },
    { label: 'Gjendja e arkës', value: formatEuro(Number(cash.register?.current_balance ?? 0)), delta: 'Live', icon: Banknote },
  ]

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
            <button className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${activeView === item.label ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100'}`} key={item.label} onClick={() => setActiveView(item.label)} type="button">
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
                <h1 className="text-xl font-semibold">{activeView === 'Paneli' ? selectedStore?.name ?? 'Dyqani' : activeView}</h1>
                <p className="text-sm text-slate-500">{activeNav.description}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setSelectedStoreId(Number(event.target.value))} value={selectedStoreId ?? ''}>
                  {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
                  <input className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600 sm:w-56" onChange={(event) => setSearch(event.target.value)} placeholder="Kërko IMEI ose model" value={search} />
                </label>
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" onClick={() => setModalMode('inventory')} type="button">
                  <PackagePlus size={17} />
                  Artikull i ri
                </button>
                <button className="h-10 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={logout} type="button">Dil</button>
              </div>
            </div>
            <p className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">{isLoading ? 'Duke ngarkuar...' : notice}</p>
          </div>
        </header>

        <div className="space-y-6 p-4 lg:p-6">
          {activeView === 'Paneli' && (
            <>
              <Metrics metrics={metrics} />
              <DashboardCharts transactions={cash.transactions?.data ?? []} />
              <InventoryTable filteredInventory={filteredInventory} onExport={exportInventory} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
            </>
          )}
          {activeView === 'Inventari' && <InventoryTable filteredInventory={filteredInventory} onExport={exportInventory} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
          {activeView === 'Shitjet' && <SalesView inventory={inventory} onOpenSale={() => setModalMode('sale')} />}
          {activeView === 'Arka' && <CashView cash={cash} onOpenCash={(type) => { setCashForm((form) => ({ ...form, type })); setModalMode('cash') }} />}
          {activeView === 'Përdoruesit' && <UsersView users={users} onOpenUser={() => setModalMode('user')} />}
          {activeView === 'Ndërrimet' && <InfoPanel title="Ndërrimet" text="Workflow i ndërrimeve është në backend. Forma e plotë për trade-in do të jetë hapi pas shitjeve normale dhe inventarit." />}
          {activeView === 'Historiku' && <InfoPanel title="Historiku" text="Audit log ruhet në backend për login, inventar, shitje, arkë dhe përdorues." />}
        </div>
      </section>

      {modalMode === 'inventory' && (
        <Modal title="Shto artikull të ri" onClose={() => setModalMode(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createInventoryItem}>
            {[
              ['brand', 'Brendi'],
              ['model', 'Modeli'],
              ['imei', 'IMEI'],
              ['color', 'Ngjyra'],
              ['storage', 'Memoria'],
              ['purchase_price', 'Çmimi i blerjes'],
              ['selling_price', 'Çmimi i shitjes'],
            ].map(([key, label]) => (
              <Field key={key} label={label} value={inventoryForm[key as keyof typeof inventoryForm]} onChange={(value) => setInventoryForm((form) => ({ ...form, [key]: value }))} />
            ))}
            <SubmitRow submitLabel="Ruaj artikullin" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {modalMode === 'user' && (
        <Modal title="Shto përdorues" onClose={() => setModalMode(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createUser}>
            <Field label="Emri" value={userForm.name} onChange={(value) => setUserForm((form) => ({ ...form, name: value }))} />
            <Field label="Email" value={userForm.email} onChange={(value) => setUserForm((form) => ({ ...form, email: value }))} />
            <Field label="Fjalëkalimi" type="password" value={userForm.password} onChange={(value) => setUserForm((form) => ({ ...form, password: value }))} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Roli</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setUserForm((form) => ({ ...form, role: event.target.value }))} value={userForm.role}>
                <option value="employee">Punëtor</option>
                <option value="store_owner">Pronar dyqani</option>
              </select>
            </label>
            <SubmitRow submitLabel="Ruaj përdoruesin" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {modalMode === 'cash' && (
        <Modal title="Lëvizje arke" onClose={() => setModalMode(null)}>
          <form className="grid gap-3" onSubmit={createCashTransaction}>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Tipi</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setCashForm((form) => ({ ...form, type: event.target.value }))} value={cashForm.type}>
                <option value="deposit">Depozitim</option>
                <option value="withdraw">Tërheqje</option>
                <option value="expense">Shpenzim</option>
              </select>
            </label>
            <Field label="Shuma" value={cashForm.amount} onChange={(value) => setCashForm((form) => ({ ...form, amount: value }))} />
            <Field label="Shënim" value={cashForm.notes} onChange={(value) => setCashForm((form) => ({ ...form, notes: value }))} />
            <SubmitRow submitLabel="Regjistro" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {modalMode === 'sale' && (
        <Modal title="Regjistro shitje" onClose={() => setModalMode(null)}>
          <form className="grid gap-3" onSubmit={createSale}>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Artikulli</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setSaleForm((form) => ({ ...form, inventory_item_id: event.target.value }))} value={saleForm.inventory_item_id}>
                <option value="">Zgjidh artikullin</option>
                {inventory.filter((item) => item.status === 'in_stock').map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} - {formatEuro(Number(item.selling_price))}</option>)}
              </select>
            </label>
            <Field label="Çmimi i shitjes" value={saleForm.selling_price} onChange={(value) => setSaleForm((form) => ({ ...form, selling_price: value }))} />
            <SubmitRow submitLabel="Regjistro shitjen" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}
    </main>
  )
}

function LoginScreen({ form, isLoading, notice, onChange, onSubmit }: { form: { email: string; password: string }; isLoading: boolean; notice: string; onChange: (form: { email: string; password: string }) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-600 text-white"><Store size={20} /></div>
          <div><h1 className="text-xl font-semibold">Stoku</h1><p className="text-sm text-slate-500">Kyçu në panel</p></div>
        </div>
        <div className="space-y-3">
          <Field label="Email" value={form.email} onChange={(value) => onChange({ ...form, email: value })} />
          <Field label="Fjalëkalimi" type="password" value={form.password} onChange={(value) => onChange({ ...form, password: value })} />
          <button className="h-10 w-full rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700" disabled={isLoading} type="submit">{isLoading ? 'Duke u kyçur...' : 'Kyçu'}</button>
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</p>
        </div>
      </form>
    </main>
  )
}

function Metrics({ metrics }: { metrics: Array<{ label: string; value: string; delta: string; icon: typeof Boxes }> }) {
  return <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" key={metric.label}><div className="flex items-center justify-between"><p className="text-sm text-slate-500">{metric.label}</p><metric.icon className="text-slate-400" size={18} /></div><div className="mt-3 flex items-end justify-between gap-3"><strong className="text-2xl font-semibold">{metric.value}</strong><span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{metric.delta}</span></div></article>)}</section>
}

function DashboardCharts({ transactions }: { transactions: CashTransaction[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">Trendi i shitjeve dhe fitimit</h2><p className="text-sm text-slate-500">Të ardhurat ditore krahasuar me fitimin</p></div><CircleDollarSign className="text-slate-400" size={20} /></div>
        <Chart height={304} options={chartOptions} series={[{ name: 'Të ardhurat', data: [8200, 6700, 9100, 7400, 10200, 12800, 7890] }, { name: 'Fitimi', data: [2100, 1800, 2700, 2200, 3100, 3900, 2400] }]} type="area" />
      </article>
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Transaksionet e fundit</h2>
        <div className="mt-4 space-y-3">{(transactions ?? []).slice(0, 5).map((transaction) => <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3" key={transaction.id}><div className="flex items-center gap-3"><div className={`flex size-9 items-center justify-center rounded-md ${transaction.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{transaction.direction === 'in' ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</div><div><p className="text-sm font-medium">{cashTypeLabel(transaction.type)}</p><p className="text-xs text-slate-500">{new Date(transaction.created_at).toLocaleString()}</p></div></div><p className="text-sm font-semibold">{formatEuro(Number(transaction.amount))}</p></div>)}</div>
      </article>
    </section>
  )
}

function InventoryTable({ filteredInventory, onExport, search, setStatusFilter, statusFilter }: { filteredInventory: InventoryApiItem[]; onExport: () => void; search: string; setStatusFilter: (status: string) => void; statusFilter: string }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">Inventari</h2><p className="text-sm text-slate-500">{filteredInventory.length} artikuj {search ? `për "${search}"` : 'nga backend'}</p></div><div className="flex gap-2"><select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}><option>Të gjitha</option><option>Në stok</option><option>Rezervuar</option><option>Shitur</option><option>Dëmtuar</option></select><button className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={onExport} type="button"><Download size={16} />Eksporto</button></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-medium">IMEI</th><th className="px-4 py-3 font-medium">Produkti</th><th className="px-4 py-3 font-medium">Ngjyra</th><th className="px-4 py-3 font-medium">Memoria</th><th className="px-4 py-3 font-medium">Kosto</th><th className="px-4 py-3 font-medium">Çmimi</th><th className="px-4 py-3 font-medium">Statusi</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredInventory.map((item) => <tr className="hover:bg-slate-50" key={item.id}><td className="px-4 py-3 font-mono text-xs text-slate-600">{item.imei ?? 'Nuk ka'}</td><td className="px-4 py-3 font-medium">{item.brand} {item.model}</td><td className="px-4 py-3">{item.color ?? '-'}</td><td className="px-4 py-3">{item.storage ?? '-'}</td><td className="px-4 py-3">{formatEuro(Number(item.purchase_price))}</td><td className="px-4 py-3 font-semibold">{formatEuro(Number(item.selling_price))}</td><td className="px-4 py-3"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{statusLabel(item.status)}</span></td></tr>)}</tbody></table></div>
    </section>
  )
}

function SalesView({ inventory, onOpenSale }: { inventory: InventoryApiItem[]; onOpenSale: () => void }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-base font-semibold">Shitjet</h2><p className="text-sm text-slate-500">{inventory.filter((item) => item.status === 'in_stock').length} artikuj të gatshëm për shitje.</p></div><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onOpenSale} type="button">Regjistro shitje</button></div></section>
}

function CashView({ cash, onOpenCash }: { cash: CashState; onOpenCash: (type: string) => void }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">Arka</h2><p className="text-sm text-slate-500">Gjendja aktuale: {formatEuro(Number(cash.register?.current_balance ?? 0))}</p></div><div className="flex gap-2"><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('deposit')} type="button">Depozitim</button><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('withdraw')} type="button">Tërheqje</button><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('expense')} type="button">Shpenzim</button></div></div></section>
}

function UsersView({ onOpenUser, users }: { onOpenUser: () => void; users: StoreUser[] }) {
  return <section className="rounded-md border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="text-base font-semibold">Përdoruesit</h2><p className="text-sm text-slate-500">{users.length} përdorues në dyqan.</p></div><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onOpenUser} type="button">Shto përdorues</button></div><div className="divide-y">{users.map((user) => <div className="flex items-center justify-between px-4 py-3" key={user.id}><div><p className="font-medium">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{user.status}</span></div>)}</div></section>
}

function InfoPanel({ text, title }: { text: string; title: string }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></section>
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-md bg-white shadow-xl"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-base font-semibold">{title}</h2><button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button></div><div className="p-4">{children}</div></div></div>
}

function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">{label}</span><input className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600" onChange={(event) => onChange(event.target.value)} required={label !== 'IMEI' && label !== 'Shënim'} type={type} value={value} /></label>
}

function SubmitRow({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 sm:col-span-2"><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={onCancel} type="button">Anulo</button><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">{submitLabel}</button></div>
}

function statusLabel(status: string) {
  return ({ in_stock: 'Në stok', reserved: 'Rezervuar', sold: 'Shitur', damaged: 'Dëmtuar', exchanged_out: 'Dalë në ndërrim', returned: 'Kthyer' } as Record<string, string>)[status] ?? status
}

function cashTypeLabel(type: string) {
  return ({ manual_deposit: 'Depozitim', manual_withdrawal: 'Tërheqje', expense: 'Shpenzim', sale_income: 'Shitje', exchange_income: 'Ndërrim' } as Record<string, string>)[type] ?? type
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('de-DE', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

export default App
