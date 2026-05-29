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
  HandCoins,
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
type SaleApiRecord = { id: number; sale_number: string; total: string; profit: string; payment_method: string; created_at: string }
type ModalMode = 'inventory' | 'user' | 'cash' | 'sale' | null
type SaleMode = 'cash' | 'exchange_even' | 'exchange_with_cash'

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
  const [sales, setSales] = useState<SaleApiRecord[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Të gjitha')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [notice, setNotice] = useState('Kyçu për të nisur punën.')
  const [isLoading, setIsLoading] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [inventoryForm, setInventoryForm] = useState({ brand: '', model: '', imei: '', color: '', storage: '', purchase_price: '', selling_price: '' })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'employee' })
  const [cashForm, setCashForm] = useState({ type: 'deposit', amount: '', notes: '' })
  const [saleMode, setSaleMode] = useState<SaleMode>('cash')
  const [saleForm, setSaleForm] = useState({ inventory_item_id: '', selling_price: '' })
  const [exchangeForm, setExchangeForm] = useState({
    outgoing_item_id: '',
    cash_difference: '',
    cash_direction: 'customer_pays',
    estimated_incoming_value: '',
    outgoing_sale_value: '',
    notes: '',
    incoming_brand: '',
    incoming_model: '',
    incoming_imei: '',
    incoming_color: '',
    incoming_storage: '',
    incoming_purchase_price: '',
    incoming_selling_price: '',
  })

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

  const stockValue = inventory.filter((item) => item.status === 'in_stock').reduce((total, item) => total + Number(item.purchase_price), 0)
  const stockCount = inventory.filter((item) => item.status === 'in_stock').length
  const activeStorePath = selectedStoreId ? `/stores/${selectedStoreId}` : ''
  const cashTransactions = cash.transactions?.data ?? []
  const todaysCash = cashSummaryForToday(cashTransactions)
  const todaysSales = sales.filter((sale) => isToday(sale.created_at)).reduce((total, sale) => total + Number(sale.total), 0)
  const weeklyCash = weeklyCashSeries(cashTransactions)

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
      const [inventoryResult, usersResult, cashResult, salesResult] = await Promise.all([
        api<{ data: Array<InventoryApiItem> }>(`${activeStorePath}/inventory?per_page=100`),
        api<{ data: Array<StoreUser> }>(`${activeStorePath}/users`),
        api<CashState>(`${activeStorePath}/cash?per_page=100`),
        api<{ data: Array<SaleApiRecord> }>(`${activeStorePath}/sales?per_page=100`),
      ])
      setInventory(inventoryResult.data)
      setUsers(usersResult.data)
      setCash(cashResult)
      setSales(salesResult.data)
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
      if (saleMode !== 'cash') {
        const isEvenExchange = saleMode === 'exchange_even'
        await api(`${activeStorePath}/sales/exchange`, {
          body: JSON.stringify({
            outgoing_item_id: Number(exchangeForm.outgoing_item_id),
            cash_difference: isEvenExchange ? 0 : Number(exchangeForm.cash_difference || 0),
            cash_direction: isEvenExchange ? 'none' : exchangeForm.cash_direction,
            estimated_incoming_value: exchangeForm.estimated_incoming_value ? Number(exchangeForm.estimated_incoming_value) : undefined,
            outgoing_sale_value: exchangeForm.outgoing_sale_value ? Number(exchangeForm.outgoing_sale_value) : undefined,
            notes: exchangeForm.notes || undefined,
            incoming_item: {
              brand: exchangeForm.incoming_brand,
              model: exchangeForm.incoming_model,
              imei: exchangeForm.incoming_imei || undefined,
              color: exchangeForm.incoming_color || undefined,
              storage: exchangeForm.incoming_storage || undefined,
              purchase_price: Number(exchangeForm.incoming_purchase_price),
              selling_price: Number(exchangeForm.incoming_selling_price),
              notes: exchangeForm.notes || undefined,
            },
          }),
          method: 'POST',
        })
        setModalMode(null)
        resetSaleForms()
        setNotice(isEvenExchange ? 'Ndërrimi kokë më kokë u regjistrua dhe stoku u përditësua.' : 'Ndërrimi me diferencë cash u regjistrua dhe arka/stoku u përditësuan.')
        await loadStoreData()
        setActiveView('Ndërrimet')
        return
      }

      await api(`${activeStorePath}/sales/normal`, {
        body: JSON.stringify({
          inventory_item_id: Number(saleForm.inventory_item_id),
          payment_method: 'cash',
          selling_price: saleForm.selling_price ? Number(saleForm.selling_price) : undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      resetSaleForms()
      setNotice('Shitja u regjistrua në backend dhe artikulli doli nga stoku.')
      await loadStoreData()
      setActiveView('Shitjet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi i shitjes dështoi.')
    }
  }

  function resetSaleForms() {
    setSaleMode('cash')
    setSaleForm({ inventory_item_id: '', selling_price: '' })
    setExchangeForm({
      outgoing_item_id: '',
      cash_difference: '',
      cash_direction: 'customer_pays',
      estimated_incoming_value: '',
      outgoing_sale_value: '',
      notes: '',
      incoming_brand: '',
      incoming_model: '',
      incoming_imei: '',
      incoming_color: '',
      incoming_storage: '',
      incoming_purchase_price: '',
      incoming_selling_price: '',
    })
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
    { label: 'Shitje sot', value: formatEuro(todaysSales), delta: `${sales.filter((sale) => isToday(sale.created_at)).length} fatura`, icon: ReceiptText },
    { label: 'Cash sot', value: formatEuro(todaysCash.in - todaysCash.out), delta: `${formatEuro(todaysCash.in)} hyrje`, icon: Banknote },
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
              <DailyCashSummary balance={Number(cash.register?.current_balance ?? 0)} cashIn={todaysCash.in} cashOut={todaysCash.out} />
              <DashboardCharts transactions={cashTransactions} weeklyCash={weeklyCash} />
              <InventoryTable filteredInventory={filteredInventory} onExport={exportInventory} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
            </>
          )}
          {activeView === 'Inventari' && <InventoryTable filteredInventory={filteredInventory} onExport={exportInventory} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
          {activeView === 'Shitjet' && <SalesView inventory={inventory} sales={sales} onOpenSale={() => { setSaleMode('cash'); setModalMode('sale') }} />}
          {activeView === 'Arka' && <CashView cash={cash} onOpenCash={(type) => { setCashForm((form) => ({ ...form, type })); setModalMode('cash') }} />}
          {activeView === 'Përdoruesit' && <UsersView users={users} onOpenUser={() => setModalMode('user')} />}
          {activeView === 'Ndërrimet' && <ExchangeView inventory={inventory} onOpenEvenExchange={() => { setSaleMode('exchange_even'); setModalMode('sale') }} onOpenPaidExchange={() => { setSaleMode('exchange_with_cash'); setModalMode('sale') }} />}
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
        <Modal title="Regjistro shitje ose ndërrim" onClose={() => setModalMode(null)}>
          <form className="grid gap-3" onSubmit={createSale}>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['cash', 'Vetëm shitje', 'Artikulli shitet dhe del nga stoku.'],
                ['exchange_even', 'Këmbim kokë më kokë', 'Del një telefon, hyn një tjetër, pa para.'],
                ['exchange_with_cash', 'Këmbim me cash', 'Ndërrim me pagesë nga klienti ose dyqani.'],
              ].map(([mode, label, description]) => (
                <button className={`rounded-md border p-3 text-left text-sm ${saleMode === mode ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:bg-slate-50'}`} key={mode} onClick={() => setSaleMode(mode as SaleMode)} type="button">
                  <span className="font-semibold">{label}</span>
                  <span className="mt-1 block text-xs text-slate-500">{description}</span>
                </button>
              ))}
            </div>

            {saleMode === 'cash' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Artikulli</span>
                  <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setSaleForm((form) => ({ ...form, inventory_item_id: event.target.value }))} required value={saleForm.inventory_item_id}>
                    <option value="">Zgjidh artikullin</option>
                    {inventory.filter((item) => item.status === 'in_stock').map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} - {formatEuro(Number(item.selling_price))}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Çmimi i shitjes" value={saleForm.selling_price} onChange={(value) => setSaleForm((form) => ({ ...form, selling_price: value }))} />
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    <p className="font-medium">Pagesa: Cash</p>
                    <p className="text-xs">Shuma regjistrohet automatikisht në arkën e dyqanit.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Telefoni që del nga stoku</span>
                  <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setExchangeForm((form) => ({ ...form, outgoing_item_id: event.target.value }))} required value={exchangeForm.outgoing_item_id}>
                    <option value="">Zgjidh artikullin</option>
                    {inventory.filter((item) => item.status === 'in_stock').map((item) => <option key={item.id} value={item.id}>{item.brand} {item.model} - {formatEuro(Number(item.selling_price))}</option>)}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Brendi hyrës" value={exchangeForm.incoming_brand} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_brand: value }))} />
                  <Field label="Modeli hyrës" value={exchangeForm.incoming_model} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_model: value }))} />
                  <Field label="IMEI" value={exchangeForm.incoming_imei} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_imei: value }))} />
                  <Field label="Ngjyra" value={exchangeForm.incoming_color} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_color: value }))} />
                  <Field label="Memoria" value={exchangeForm.incoming_storage} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_storage: value }))} />
                  <Field label="Vlera e blerjes hyrëse" value={exchangeForm.incoming_purchase_price} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_purchase_price: value }))} />
                  <Field label="Çmimi i shitjes hyrëse" value={exchangeForm.incoming_selling_price} onChange={(value) => setExchangeForm((form) => ({ ...form, incoming_selling_price: value }))} />
                  <Field label="Vlera e telefonit që del" value={exchangeForm.outgoing_sale_value} onChange={(value) => setExchangeForm((form) => ({ ...form, outgoing_sale_value: value }))} />
                </div>
                {saleMode === 'exchange_with_cash' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Drejtimi i cash-it</span>
                      <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setExchangeForm((form) => ({ ...form, cash_direction: event.target.value }))} value={exchangeForm.cash_direction}>
                        <option value="customer_pays">Klienti paguan</option>
                        <option value="store_pays">Dyqani paguan</option>
                      </select>
                    </label>
                    <Field label="Shuma cash" value={exchangeForm.cash_difference} onChange={(value) => setExchangeForm((form) => ({ ...form, cash_difference: value }))} />
                  </div>
                )}
                <Field label="Shënim" value={exchangeForm.notes} onChange={(value) => setExchangeForm((form) => ({ ...form, notes: value }))} />
              </>
            )}
            <SubmitRow submitLabel={saleMode === 'cash' ? 'Regjistro shitjen' : 'Regjistro ndërrimin'} onCancel={() => setModalMode(null)} />
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

function DailyCashSummary({ balance, cashIn, cashOut }: { balance: number; cashIn: number; cashOut: number }) {
  const net = cashIn - cashOut

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Gjendja totale e arkës</p>
        <strong className="mt-2 block text-2xl font-semibold">{formatEuro(balance)}</strong>
      </article>
      <article className="rounded-md border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-700">Hyrje cash sot</p>
        <strong className="mt-2 block text-2xl font-semibold text-emerald-800">{formatEuro(cashIn)}</strong>
      </article>
      <article className="rounded-md border border-rose-100 bg-rose-50 p-4">
        <p className="text-sm text-rose-700">Dalje cash sot</p>
        <strong className="mt-2 block text-2xl font-semibold text-rose-800">{formatEuro(cashOut)}</strong>
        <p className="mt-1 text-xs text-slate-500">Neto: {formatEuro(net)}</p>
      </article>
    </section>
  )
}

function DashboardCharts({ transactions, weeklyCash }: { transactions: CashTransaction[]; weeklyCash: { labels: string[]; incoming: number[]; outgoing: number[] } }) {
  const options = { ...chartOptions, xaxis: { categories: weeklyCash.labels } }

  return (
    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold">Cash 7 ditët e fundit</h2><p className="text-sm text-slate-500">Hyrjet dhe daljet nga shitjet, ndërrimet dhe arka</p></div><CircleDollarSign className="text-slate-400" size={20} /></div>
        <Chart height={304} options={options} series={[{ name: 'Hyrje', data: weeklyCash.incoming }, { name: 'Dalje', data: weeklyCash.outgoing }]} type="area" />
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

function SalesView({ inventory, onOpenSale, sales }: { inventory: InventoryApiItem[]; onOpenSale: () => void; sales: SaleApiRecord[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold">Shitjet</h2><p className="text-sm text-slate-500">{inventory.filter((item) => item.status === 'in_stock').length} artikuj të gatshëm për shitje.</p></div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onOpenSale} type="button"><ReceiptText size={16} />Regjistro shitje</button>
      </div>
      <div className="divide-y">
        {sales.slice(0, 8).map((sale) => (
          <div className="flex items-center justify-between gap-3 px-4 py-3" key={sale.id}>
            <div><p className="font-medium">{sale.sale_number}</p><p className="text-sm text-slate-500">{new Date(sale.created_at).toLocaleString()} · {paymentLabel(sale.payment_method)}</p></div>
            <div className="text-right"><p className="font-semibold">{formatEuro(Number(sale.total))}</p><p className="text-xs text-emerald-700">Fitimi {formatEuro(Number(sale.profit))}</p></div>
          </div>
        ))}
        {!sales.length && <p className="px-4 py-6 text-sm text-slate-500">Ende nuk ka shitje të regjistruara.</p>}
      </div>
    </section>
  )
}

function ExchangeView({ inventory, onOpenEvenExchange, onOpenPaidExchange }: { inventory: InventoryApiItem[]; onOpenEvenExchange: () => void; onOpenPaidExchange: () => void }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-blue-50 text-blue-700"><Repeat2 size={20} /></div>
          <div><h2 className="text-base font-semibold">Ndërrimet</h2><p className="text-sm text-slate-500">Regjistro telefonin që del dhe atë që hyn në stok.</p></div>
        </div>
        <div className="mt-4 grid gap-2">
          <button className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={onOpenEvenExchange} type="button"><Repeat2 size={16} />Këmbim kokë më kokë</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={onOpenPaidExchange} type="button"><HandCoins size={16} />Këmbim me cash</button>
        </div>
      </article>
      <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold">Artikuj të gatshëm për ndërrim</h2>
        <div className="mt-3 divide-y">
          {inventory.filter((item) => item.status === 'in_stock').slice(0, 6).map((item) => (
            <div className="flex items-center justify-between gap-3 py-3" key={item.id}>
              <div><p className="font-medium">{item.brand} {item.model}</p><p className="text-sm text-slate-500">{item.imei ?? 'Pa IMEI'} · {item.storage ?? '-'}</p></div>
              <p className="font-semibold">{formatEuro(Number(item.selling_price))}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
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
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-xl"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-base font-semibold">{title}</h2><button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button></div><div className="max-h-[calc(92vh-57px)] overflow-y-auto p-4">{children}</div></div></div>
}

function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  const optionalLabels = ['IMEI', 'Shënim', 'Ngjyra', 'Memoria', 'Vlera e telefonit që del']

  return <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">{label}</span><input className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600" onChange={(event) => onChange(event.target.value)} required={!optionalLabels.includes(label)} type={type} value={value} /></label>
}

function SubmitRow({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 sm:col-span-2"><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={onCancel} type="button">Anulo</button><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">{submitLabel}</button></div>
}

function statusLabel(status: string) {
  return ({ in_stock: 'Në stok', reserved: 'Rezervuar', sold: 'Shitur', damaged: 'Dëmtuar', exchanged_out: 'Dalë në ndërrim', returned: 'Kthyer' } as Record<string, string>)[status] ?? status
}

function cashTypeLabel(type: string) {
  return ({ manual_deposit: 'Depozitim', manual_withdrawal: 'Tërheqje', expense: 'Shpenzim', sale_income: 'Shitje', exchange_income: 'Ndërrim hyrje', exchange_payout: 'Ndërrim dalje' } as Record<string, string>)[type] ?? type
}

function paymentLabel(method: string) {
  return ({ cash: 'Cash', card: 'Kartelë', mixed: 'E përzier', other: 'Tjetër' } as Record<string, string>)[method] ?? method
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('de-DE', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

function isToday(value: string) {
  const date = new Date(value)
  const today = new Date()

  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
}

function cashSummaryForToday(transactions: CashTransaction[]) {
  return transactions.reduce((summary, transaction) => {
    if (!isToday(transaction.created_at)) return summary
    const amount = Number(transaction.amount)
    if (transaction.direction === 'in') {
      summary.in += amount
    } else {
      summary.out += amount
    }

    return summary
  }, { in: 0, out: 0 })
}

function weeklyCashSeries(transactions: CashTransaction[]) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return date
  })

  return {
    labels: days.map((date) => date.toLocaleDateString('sq-AL', { weekday: 'short' })),
    incoming: days.map((date) => sumCashForDate(transactions, date, 'in')),
    outgoing: days.map((date) => sumCashForDate(transactions, date, 'out')),
  }
}

function sumCashForDate(transactions: CashTransaction[], date: Date, direction: 'in' | 'out') {
  return transactions.reduce((total, transaction) => {
    const transactionDate = new Date(transaction.created_at)
    const sameDay = transactionDate.getFullYear() === date.getFullYear() && transactionDate.getMonth() === date.getMonth() && transactionDate.getDate() === date.getDate()

    return sameDay && transaction.direction === direction ? total + Number(transaction.amount) : total
  }, 0)
}

export default App
