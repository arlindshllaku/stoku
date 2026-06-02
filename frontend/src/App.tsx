import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import Chart from 'react-apexcharts'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Download,
  HandCoins,
  LayoutDashboard,
  PackagePlus,
  Pencil,
  ReceiptText,
  Repeat2,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import './index.css'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? `${window.location.protocol}//${window.location.hostname}:8000/api/v1`

type StoreRecord = { id: number; name: string }
type InventoryApiItem = {
  id: number
  category_id?: number | null
  supplier_id?: number | null
  imei: string | null
  brand: string
  model: string
  color: string | null
  storage: string | null
  purchase_price: string
  selling_price: string
  sold_price?: string | null
  status: string
  date_added?: string | null
  notes?: string | null
}
type StoreUser = { id: number; name: string; email: string; status: string; roles?: UserRole[] }
type CashTransaction = { id: number; type: string; amount: string; direction: string; created_at: string }
type SaleItemRecord = { id: number; description: string; inventory_item_id?: number | null; inventory_item?: InventoryApiItem | null; quantity: number; unit_price: string; unit_cost: string; profit: string }
type SaleApiRecord = { id: number; sale_number: string; type?: string; subtotal?: string; discount?: string; total: string; profit: string; payment_method: string; created_at: string; items?: SaleItemRecord[] }
type ExchangeIncomingRecord = { id: number; estimated_value: string; item?: InventoryApiItem | null }
type ExchangeApiRecord = { id: number; cash_difference: string; cash_direction: string; estimated_incoming_value: string; outgoing_sale_value: string; profit_loss: string; notes?: string | null; created_at: string; outgoing_item?: InventoryApiItem | null; incoming_item?: InventoryApiItem | null; incoming_items?: ExchangeIncomingRecord[] }
type PurchaseApiRecord = { id: number; purchase_number: string; purchase_price: string; expected_selling_price: string; inventory_item_id: number; notes?: string | null; created_at: string; item?: InventoryApiItem | null }
type UserRole = { id: number; name: string; scope: string; pivot?: { store_id: number | null } }
type CurrentUser = { id: number; name: string; email: string; roles?: UserRole[] }
type InventorySummary = { total_items: number; stock_count: number; stock_value: number | string }
type PaginationMeta = { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null }
type PaginatedApiResponse<T> = PaginationMeta & { data: T[]; summary?: InventorySummary }
type ReportApiResponse<T> = { data: T[]; summary?: Record<string, number | string> }
type CashState = { register?: { current_balance: string }; transactions?: PaginatedApiResponse<CashTransaction> }
type ModalMode = 'inventory' | 'editInventory' | 'user' | 'editUser' | 'cash' | 'sale' | 'editSale' | 'store' | 'exchange' | 'purchase' | 'editPurchase' | null
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom'

const emptyPaginationMeta: PaginationMeta = { current_page: 1, last_page: 1, per_page: 20, total: 0, from: null, to: null }
const emptyInventorySummary: InventorySummary = { total_items: 0, stock_count: 0, stock_value: 0 }
const emptyInventoryForm = { brand: '', model: '', imei: '', color: '', storage: '', purchase_price: '', selling_price: '', status: 'in_stock', date_added: '', notes: '' }

const navItems = [
  { icon: LayoutDashboard, label: 'Paneli', description: 'Pamje e përgjithshme e dyqanit' },
  { icon: Boxes, label: 'Inventari', description: 'Kërko, filtro dhe shto artikuj' },
  { icon: ReceiptText, label: 'Shitjet', description: 'Shitje të telefonave nga stoku te klienti' },
  { icon: Repeat2, label: 'Ndërrimet', description: 'Menaxho trade-in dhe diferenca pagese' },
  { icon: HandCoins, label: 'Blerjet', description: 'Telefona që klientët ia shesin dyqanit' },
  { icon: Banknote, label: 'Arka', description: 'Depozitime, tërheqje dhe shpenzime' },
  { icon: BarChart3, label: 'Raportet', description: 'Shitjet ditore, javore, mujore dhe periudha të zgjedhura' },
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
  const [availableInventory, setAvailableInventory] = useState<InventoryApiItem[]>([])
  const [inventoryMeta, setInventoryMeta] = useState<PaginationMeta>(emptyPaginationMeta)
  const [inventorySummary, setInventorySummary] = useState<InventorySummary>(emptyInventorySummary)
  const [inventoryPage, setInventoryPage] = useState(1)
  const [inventoryPerPage, setInventoryPerPage] = useState(20)
  const [salesMeta, setSalesMeta] = useState<PaginationMeta>(emptyPaginationMeta)
  const [salesPage, setSalesPage] = useState(1)
  const [salesPerPage, setSalesPerPage] = useState(20)
  const [exchangesMeta, setExchangesMeta] = useState<PaginationMeta>(emptyPaginationMeta)
  const [exchangesPage, setExchangesPage] = useState(1)
  const [exchangesPerPage, setExchangesPerPage] = useState(20)
  const [purchasesMeta, setPurchasesMeta] = useState<PaginationMeta>(emptyPaginationMeta)
  const [purchasesPage, setPurchasesPage] = useState(1)
  const [purchasesPerPage, setPurchasesPerPage] = useState(20)
  const [users, setUsers] = useState<StoreUser[]>([])
  const [cash, setCash] = useState<CashState>({})
  const [sales, setSales] = useState<SaleApiRecord[]>([])
  const [exchanges, setExchanges] = useState<ExchangeApiRecord[]>([])
  const [reportSales, setReportSales] = useState<SaleApiRecord[]>([])
  const [purchases, setPurchases] = useState<PurchaseApiRecord[]>([])
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Të gjitha')
  const [stockOptionSearch, setStockOptionSearch] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [notice, setNotice] = useState('Kyçu për të nisur punën.')
  const [isLoading, setIsLoading] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [storeForm, setStoreForm] = useState({ name: '', address: '', phone: '', email: '', currency: 'EUR', timezone: 'Europe/Belgrade' })
  const [inventoryForm, setInventoryForm] = useState({ ...emptyInventoryForm })
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'employee', status: 'active' })
  const [editingInventory, setEditingInventory] = useState<InventoryApiItem | null>(null)
  const [editingUser, setEditingUser] = useState<StoreUser | null>(null)
  const [editingSale, setEditingSale] = useState<SaleApiRecord | null>(null)
  const [editingPurchase, setEditingPurchase] = useState<PurchaseApiRecord | null>(null)
  const [cashForm, setCashForm] = useState({ type: 'deposit', amount: '', notes: '' })
  const [saleForm, setSaleForm] = useState({ inventory_item_id: '', payment_method: 'cash', selling_price: '' })
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('daily')
  const [reportRange, setReportRange] = useState({ from: todayInputValue(), to: todayInputValue() })
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
    second_incoming_enabled: false,
    second_incoming_brand: '',
    second_incoming_model: '',
    second_incoming_imei: '',
    second_incoming_color: '',
    second_incoming_storage: '',
    second_incoming_purchase_price: '',
    second_incoming_selling_price: '',
  })
  const [purchaseForm, setPurchaseForm] = useState({
    purchase_price: '',
    expected_selling_price: '',
    notes: '',
    incoming_brand: '',
    incoming_model: '',
    incoming_imei: '',
    incoming_color: '',
    incoming_storage: '',
  })

  const activeNav = navItems.find((item) => item.label === activeView) ?? navItems[0]
  const selectedStore = stores.find((store) => store.id === selectedStoreId)
  const isSuperAdmin = currentUser?.roles?.some((role) => role.name === 'super_admin' && role.scope === 'platform') ?? false

  const stockValue = Number(inventorySummary.stock_value)
  const stockCount = inventorySummary.stock_count
  const activeStorePath = selectedStoreId ? `/stores/${selectedStoreId}` : ''
  const cashTransactions = cash.transactions?.data ?? []
  const todaysCash = cashSummaryForToday(cashTransactions)
  const todaysSales = sales.filter((sale) => isToday(sale.created_at)).reduce((total, sale) => total + Number(sale.total), 0)
  const weeklyCash = weeklyCashSeries(cashTransactions)

  useEffect(() => {
    if (token) {
      void loadProfile(token)
      void loadStores(token)
    }
  }, [token])

  useEffect(() => {
    if (token && selectedStoreId) {
      void loadStoreData(1)
    }
  }, [selectedStoreId, token])

  useEffect(() => {
    if (!token || !selectedStoreId) return

    const timer = window.setTimeout(() => {
      if (inventoryPage !== 1) {
        setInventoryPage(1)
      } else {
        void loadInventoryData(1)
      }
    }, 300)

    return () => window.clearTimeout(timer)
  }, [search, statusFilter, inventoryPerPage])

  useEffect(() => {
    if (token && selectedStoreId) {
      void loadInventoryData(inventoryPage)
    }
  }, [inventoryPage])

  useEffect(() => {
    if (!token || !selectedStoreId || activeView !== 'Raportet') return

    const timer = window.setTimeout(() => {
      void loadSalesReport()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [token, selectedStoreId, activeView, reportPeriod, reportRange.from, reportRange.to])

  useEffect(() => {
    if (!token || !selectedStoreId || (modalMode !== 'sale' && modalMode !== 'exchange')) return

    const timer = window.setTimeout(() => {
      void loadAvailableInventory(stockOptionSearch)
    }, 250)

    return () => window.clearTimeout(timer)
  }, [modalMode, stockOptionSearch])

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

  async function loadAllPages<T>(path: string, perPage = 100): Promise<T[]> {
    const separator = path.includes('?') ? '&' : '?'
    const firstPage = await api<PaginatedApiResponse<T>>(`${path}${separator}per_page=${perPage}`)
    const items = [...firstPage.data]

    if (firstPage.last_page > firstPage.current_page) {
      const pages = Array.from({ length: firstPage.last_page - firstPage.current_page }, (_, index) => firstPage.current_page + index + 1)
      const remainingPages = await Promise.all(
        pages.map((page) => api<PaginatedApiResponse<T>>(`${path}${separator}per_page=${perPage}&page=${page}`)),
      )
      items.push(...remainingPages.flatMap((page) => page.data))
    }

    return items
  }

  function inventoryPath(page: number, perPage = inventoryPerPage) {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
    const normalizedSearch = search.trim()
    const status = inventoryStatusValue(statusFilter)

    if (normalizedSearch) params.set('search', normalizedSearch)
    if (status) params.set('status', status)

    return `${activeStorePath}/inventory?${params.toString()}`
  }

  function inventoryFilterPath() {
    const params = new URLSearchParams()
    const normalizedSearch = search.trim()
    const status = inventoryStatusValue(statusFilter)

    if (normalizedSearch) params.set('search', normalizedSearch)
    if (status) params.set('status', status)

    return `${activeStorePath}/inventory${params.size ? `?${params.toString()}` : ''}`
  }

  function salesPath(page = salesPage, perPage = salesPerPage) {
    return `${activeStorePath}/sales?${new URLSearchParams({ page: String(page), per_page: String(perPage) }).toString()}`
  }

  function exchangesPath(page = exchangesPage, perPage = exchangesPerPage) {
    return `${activeStorePath}/exchanges?${new URLSearchParams({ page: String(page), per_page: String(perPage) }).toString()}`
  }

  function purchasesPath(page = purchasesPage, perPage = purchasesPerPage) {
    return `${activeStorePath}/purchases?${new URLSearchParams({ page: String(page), per_page: String(perPage) }).toString()}`
  }

  function salesReportPath(period = reportPeriod, range = reportRange) {
    const effectiveRange = reportRangeForPeriod(period, range)
    const params = new URLSearchParams({
      from: effectiveRange.from,
      period,
      to: effectiveRange.to,
    })

    return `${activeStorePath}/reports/sales?${params.toString()}`
  }

  function applyInventoryResult(result: PaginatedApiResponse<InventoryApiItem>) {
    setInventory(result.data)
    setInventoryMeta(paginationMeta(result))
    setInventorySummary(result.summary ?? emptyInventorySummary)
  }

  function applySalesResult(result: PaginatedApiResponse<SaleApiRecord>) {
    setSales(result.data)
    setSalesMeta(paginationMeta(result))
  }

  function applyExchangesResult(result: PaginatedApiResponse<ExchangeApiRecord>) {
    setExchanges(result.data)
    setExchangesMeta(paginationMeta(result))
  }

  function applyPurchasesResult(result: PaginatedApiResponse<PurchaseApiRecord>) {
    setPurchases(result.data)
    setPurchasesMeta(paginationMeta(result))
  }

  async function loadInventoryData(page = inventoryPage) {
    if (!selectedStoreId) return

    try {
      const result = await api<PaginatedApiResponse<InventoryApiItem>>(inventoryPath(page))

      if (!result.data.length && result.current_page > 1) {
        setInventoryPage(result.current_page - 1)
        return
      }

      applyInventoryResult(result)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i inventarit dështoi.')
    }
  }

  async function loadSalesData(page = salesPage, perPage = salesPerPage) {
    if (!selectedStoreId) return

    try {
      const result = await api<PaginatedApiResponse<SaleApiRecord>>(salesPath(page, perPage))

      if (!result.data.length && result.current_page > 1) {
        setSalesPage(result.current_page - 1)
        void loadSalesData(result.current_page - 1, perPage)
        return
      }

      setSalesPage(result.current_page)
      setSalesPerPage(Number(result.per_page))
      applySalesResult(result)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i shitjeve dështoi.')
    }
  }

  async function loadExchangesData(page = exchangesPage, perPage = exchangesPerPage) {
    if (!selectedStoreId) return

    try {
      const result = await api<PaginatedApiResponse<ExchangeApiRecord>>(exchangesPath(page, perPage))

      if (!result.data.length && result.current_page > 1) {
        setExchangesPage(result.current_page - 1)
        void loadExchangesData(result.current_page - 1, perPage)
        return
      }

      setExchangesPage(result.current_page)
      setExchangesPerPage(Number(result.per_page))
      applyExchangesResult(result)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i ndërrimeve dështoi.')
    }
  }

  async function loadPurchasesData(page = purchasesPage, perPage = purchasesPerPage) {
    if (!selectedStoreId) return

    try {
      const result = await api<PaginatedApiResponse<PurchaseApiRecord>>(purchasesPath(page, perPage))

      if (!result.data.length && result.current_page > 1) {
        setPurchasesPage(result.current_page - 1)
        void loadPurchasesData(result.current_page - 1, perPage)
        return
      }

      setPurchasesPage(result.current_page)
      setPurchasesPerPage(Number(result.per_page))
      applyPurchasesResult(result)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i blerjeve dështoi.')
    }
  }

  async function loadAvailableInventory(searchTerm = '') {
    if (!selectedStoreId) return

    const params = new URLSearchParams({ status: 'in_stock', per_page: '50' })
    const normalizedSearch = searchTerm.trim()

    if (normalizedSearch) params.set('search', normalizedSearch)

    try {
      const result = await api<PaginatedApiResponse<InventoryApiItem>>(`${activeStorePath}/inventory?${params.toString()}`)
      setAvailableInventory(result.data)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ngarkimi i artikujve të stokut dështoi.')
    }
  }

  async function loadCashState(): Promise<CashState> {
    const firstPage = await api<CashState>(`${activeStorePath}/cash?per_page=100`)
    const transactions = firstPage.transactions

    if (!transactions || transactions.last_page <= transactions.current_page) {
      return firstPage
    }

    const pages = Array.from({ length: transactions.last_page - transactions.current_page }, (_, index) => transactions.current_page + index + 1)
    const remainingPages = await Promise.all(
      pages.map((page) => api<CashState>(`${activeStorePath}/cash?per_page=100&page=${page}`)),
    )

    return {
      ...firstPage,
      transactions: {
        ...transactions,
        data: [
          ...transactions.data,
          ...remainingPages.flatMap((page) => page.transactions?.data ?? []),
        ],
        current_page: transactions.last_page,
      },
    }
  }

  async function loadSalesReport(period = reportPeriod, range = reportRange) {
    if (!selectedStoreId) return

    try {
      const result = await api<ReportApiResponse<SaleApiRecord>>(salesReportPath(period, range))
      setReportSales(result.data)
    } catch (error) {
      setReportSales([])
      if (activeView === 'Raportet') {
        setNotice(error instanceof Error ? error.message : 'Ngarkimi i raportit të shitjeve dështoi.')
      }
    }
  }

  function changeReportPeriod(period: ReportPeriod) {
    setReportPeriod(period)
    setReportRange((current) => reportRangeForPeriod(period, current))
  }

  function changeReportRange(range: { from: string; to: string }) {
    setReportRange(range)
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
      await loadProfile(result.token)
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
    setSelectedStoreId((current) => current && result.data.some((store) => store.id === current) ? current : result.data[0]?.id ?? null)
    setNotice(result.data.length ? 'Të dhënat u ngarkuan nga backend.' : 'Nuk ka dyqan të krijuar. Super admin mund ta krijojë nga paneli.')
  }

  async function loadProfile(authToken = token) {
    const result = await api<{ user: CurrentUser }>('/auth/me', {}, authToken)
    setCurrentUser(result.user)
  }

  async function loadStoreData(page = inventoryPage) {
    setIsLoading(true)
    try {
      const [inventoryResult, usersResult, cashResult, salesResult, exchangesResult, purchasesResult] = await Promise.all([
        api<PaginatedApiResponse<InventoryApiItem>>(inventoryPath(page)),
        api<{ data: Array<StoreUser> }>(`${activeStorePath}/users`).catch(() => ({ data: [] })),
        loadCashState(),
        api<PaginatedApiResponse<SaleApiRecord>>(salesPath(salesPage, salesPerPage)),
        api<PaginatedApiResponse<ExchangeApiRecord>>(exchangesPath(exchangesPage, exchangesPerPage)),
        api<PaginatedApiResponse<PurchaseApiRecord>>(purchasesPath(purchasesPage, purchasesPerPage)),
      ])
      applyInventoryResult(inventoryResult)
      setUsers(usersResult.data)
      setCash(cashResult)
      applySalesResult(salesResult)
      applyExchangesResult(exchangesResult)
      applyPurchasesResult(purchasesResult)
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
          purchase_price: inventoryForm.purchase_price ? Number(inventoryForm.purchase_price) : undefined,
          selling_price: inventoryForm.selling_price ? Number(inventoryForm.selling_price) : undefined,
          status: 'in_stock',
          date_added: inventoryForm.date_added || undefined,
          notes: inventoryForm.notes || undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      resetInventoryForm()
      setNotice('Artikulli u ruajt në backend.')
      setInventoryPage(1)
      await loadStoreData(1)
      setActiveView('Inventari')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Ruajtja e artikullit dështoi.')
    }
  }

  async function createStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const store = await api<StoreRecord>('/stores', {
        body: JSON.stringify({
          ...storeForm,
          address: storeForm.address || undefined,
          phone: storeForm.phone || undefined,
          email: storeForm.email || undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      setStoreForm({ name: '', address: '', phone: '', email: '', currency: 'EUR', timezone: 'Europe/Belgrade' })
      setNotice('Dyqani u krijua. Tani mund t’i shtosh admin/pronar te Përdoruesit.')
      await loadStores()
      setInventoryPage(1)
      setSelectedStoreId(store.id)
      setActiveView('Përdoruesit')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Krijimi i dyqanit dështoi.')
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/users`, {
        body: JSON.stringify({
          ...userForm,
          name: userForm.name || undefined,
          password: userForm.password || undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      resetUserForm()
      setNotice(
        userForm.role === 'super_admin'
          ? 'Super admini u ruajt në platformë.'
          : userForm.role === 'store_owner'
            ? 'Admini/pronari u lidh me këtë dyqan.'
            : 'Përdoruesi u lidh me këtë dyqan.',
      )
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Krijimi i përdoruesit dështoi.')
    }
  }

  async function updateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId || !editingUser) return

    try {
      await api(`${activeStorePath}/users/${editingUser.id}`, {
        body: JSON.stringify({
          name: userForm.name,
          email: userForm.email,
          password: userForm.password || undefined,
          role: userForm.role,
          status: userForm.status,
        }),
        method: 'PUT',
      })
      setModalMode(null)
      setEditingUser(null)
      resetUserForm()
      setNotice('Përdoruesi u përditësua.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Përditësimi i përdoruesit dështoi.')
    }
  }

  async function deleteUser(user: StoreUser) {
    if (!selectedStoreId) return
    const role = userRoleValue(user)
    const message = role === 'super_admin'
      ? `A dëshiron t'ia heqësh rolin Super admin përdoruesit ${user.name}?`
      : `A dëshiron ta heqësh qasjen për ${user.name} nga ky dyqan?`

    if (!window.confirm(message)) return

    try {
      await api(`${activeStorePath}/users/${user.id}`, { method: 'DELETE' })
      setNotice(role === 'super_admin' ? 'Roli Super admin u hoq.' : 'Përdoruesi u hoq nga ky dyqan.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Heqja e përdoruesit dështoi.')
    }
  }

  function openEditUser(user: StoreUser) {
    setEditingUser(user)
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: userRoleValue(user),
      status: user.status,
    })
    setModalMode('editUser')
  }

  function resetUserForm() {
    setUserForm({ name: '', email: '', password: '', role: 'employee', status: 'active' })
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
          payment_method: saleForm.payment_method,
          selling_price: saleForm.selling_price ? Number(saleForm.selling_price) : undefined,
        }),
        method: 'POST',
      })
      setModalMode(null)
      resetSaleForms()
      setNotice('Shitja u regjistrua në backend dhe artikulli doli nga stoku.')
      setSalesPage(1)
      await loadStoreData()
      await loadSalesData(1)
      setActiveView('Shitjet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi i shitjes dështoi.')
    }
  }

  async function updateInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId || !editingInventory) return

    try {
      await api(`${activeStorePath}/inventory/${editingInventory.id}`, {
        body: JSON.stringify({
          ...inventoryForm,
          imei: inventoryForm.imei.trim() || null,
          color: inventoryForm.color.trim() || null,
          storage: inventoryForm.storage.trim() || null,
          purchase_price: inventoryForm.purchase_price ? Number(inventoryForm.purchase_price) : undefined,
          selling_price: inventoryForm.selling_price ? Number(inventoryForm.selling_price) : undefined,
          date_added: inventoryForm.date_added || undefined,
          notes: inventoryForm.notes.trim() || null,
        }),
        method: 'PUT',
      })
      setModalMode(null)
      resetInventoryForm()
      setNotice('Artikulli u përditësua.')
      await loadInventoryData(inventoryPage)
      await loadStoreData()
      setActiveView('Inventari')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Përditësimi i artikullit dështoi.')
    }
  }

  async function updateSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId || !editingSale) return

    try {
      await api(`${activeStorePath}/sales/${editingSale.id}`, {
        body: JSON.stringify({
          payment_method: saleForm.payment_method,
          selling_price: saleForm.selling_price ? Number(saleForm.selling_price) : undefined,
        }),
        method: 'PUT',
      })
      setModalMode(null)
      setEditingSale(null)
      resetSaleForms()
      setNotice('Shitja u përditësua dhe arka/stoku u korrigjuan.')
      await loadStoreData()
      setActiveView('Shitjet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Përditësimi i shitjes dështoi.')
    }
  }

  async function deleteSale(sale: SaleApiRecord) {
    if (!selectedStoreId || !window.confirm(`A dëshiron ta fshish shitjen ${sale.sale_number}? Arka dhe stoku do korrigjohen.`)) return

    try {
      await api(`${activeStorePath}/sales/${sale.id}`, { method: 'DELETE' })
      setNotice('Shitja u fshi dhe arka/stoku u korrigjuan.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Fshirja e shitjes dështoi.')
    }
  }

  function openEditSale(sale: SaleApiRecord) {
    setEditingSale(sale)
    setSaleForm({
      inventory_item_id: String(salePrimaryItem(sale)?.inventory_item_id ?? ''),
      payment_method: sale.payment_method ?? 'cash',
      selling_price: String(sale.total ?? ''),
    })
    setModalMode('editSale')
  }

  function openEditInventory(item: InventoryApiItem) {
    setEditingInventory(item)
    setInventoryForm({
      brand: item.brand ?? '',
      model: item.model ?? '',
      imei: item.imei ?? '',
      color: item.color ?? '',
      storage: item.storage ?? '',
      purchase_price: item.purchase_price ?? '',
      selling_price: item.selling_price ?? '',
      status: item.status ?? 'in_stock',
      date_added: item.date_added ? item.date_added.slice(0, 10) : '',
      notes: item.notes ?? '',
    })
    setModalMode('editInventory')
  }

  function resetInventoryForm() {
    setEditingInventory(null)
    setInventoryForm({ ...emptyInventoryForm })
  }

  async function createExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    const incomingItems = [
      {
        brand: exchangeForm.incoming_brand,
        model: exchangeForm.incoming_model,
        imei: exchangeForm.incoming_imei || undefined,
        color: exchangeForm.incoming_color || undefined,
        storage: exchangeForm.incoming_storage || undefined,
        purchase_price: exchangeForm.incoming_purchase_price ? Number(exchangeForm.incoming_purchase_price) : undefined,
        selling_price: exchangeForm.incoming_selling_price ? Number(exchangeForm.incoming_selling_price) : undefined,
        notes: exchangeForm.notes || undefined,
      },
    ]

    if (exchangeForm.second_incoming_enabled) {
      incomingItems.push({
        brand: exchangeForm.second_incoming_brand,
        model: exchangeForm.second_incoming_model,
        imei: exchangeForm.second_incoming_imei || undefined,
        color: exchangeForm.second_incoming_color || undefined,
        storage: exchangeForm.second_incoming_storage || undefined,
        purchase_price: exchangeForm.second_incoming_purchase_price ? Number(exchangeForm.second_incoming_purchase_price) : undefined,
        selling_price: exchangeForm.second_incoming_selling_price ? Number(exchangeForm.second_incoming_selling_price) : undefined,
        notes: exchangeForm.notes || undefined,
      })
    }

    try {
      await api(`${activeStorePath}/sales/exchange`, {
        body: JSON.stringify({
          outgoing_item_id: Number(exchangeForm.outgoing_item_id),
          cash_difference: Number(exchangeForm.cash_difference || 0),
          cash_direction: exchangeForm.cash_direction,
          estimated_incoming_value: exchangeForm.estimated_incoming_value ? Number(exchangeForm.estimated_incoming_value) : undefined,
          outgoing_sale_value: exchangeForm.outgoing_sale_value ? Number(exchangeForm.outgoing_sale_value) : undefined,
          notes: exchangeForm.notes || undefined,
          incoming_items: incomingItems,
        }),
        method: 'POST',
      })
      setModalMode(null)
      resetExchangeForm()
      setNotice('Ndërrimi u regjistrua dhe arka/stoku u përditësuan.')
      setExchangesPage(1)
      await loadStoreData()
      await loadExchangesData(1)
      setActiveView('Ndërrimet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi i ndërrimit dështoi.')
    }
  }

  async function createCustomerPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/purchases`, {
        body: JSON.stringify(purchasePayload()),
        method: 'POST',
      })
      setModalMode(null)
      resetPurchaseForm()
      setNotice('Blerja u regjistrua: telefoni hyri në stok dhe cash-i doli nga arka.')
      setPurchasesPage(1)
      await loadStoreData()
      await loadPurchasesData(1)
      setActiveView('Blerjet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Regjistrimi i blerjes dështoi.')
    }
  }

  async function updateCustomerPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStoreId || !editingPurchase) return

    try {
      await api(`${activeStorePath}/purchases/${editingPurchase.id}`, {
        body: JSON.stringify(purchasePayload()),
        method: 'PUT',
      })
      setModalMode(null)
      setEditingPurchase(null)
      resetPurchaseForm()
      setNotice('Blerja u përditësua dhe arka/stoku u korrigjuan.')
      await loadStoreData()
      setActiveView('Blerjet')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Përditësimi i blerjes dështoi.')
    }
  }

  async function deletePurchase(purchase: PurchaseApiRecord) {
    if (!selectedStoreId || !window.confirm(`A dëshiron ta fshish blerjen ${purchase.purchase_number}? Arka dhe stoku do korrigjohen.`)) return

    try {
      await api(`${activeStorePath}/purchases/${purchase.id}`, { method: 'DELETE' })
      setNotice('Blerja u fshi dhe arka/stoku u korrigjuan.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Fshirja e blerjes dështoi.')
    }
  }

  function openEditPurchase(purchase: PurchaseApiRecord) {
    setEditingPurchase(purchase)
    setPurchaseForm({
      purchase_price: purchase.purchase_price ?? '',
      expected_selling_price: purchase.expected_selling_price ?? '',
      notes: purchase.notes ?? '',
      incoming_brand: purchase.item?.brand ?? '',
      incoming_model: purchase.item?.model ?? '',
      incoming_imei: purchase.item?.imei ?? '',
      incoming_color: purchase.item?.color ?? '',
      incoming_storage: purchase.item?.storage ?? '',
    })
    setModalMode('editPurchase')
  }

  function purchasePayload() {
    const optionalText = (value: string) => value.trim() || null

    return {
      purchase_price: purchaseForm.purchase_price ? Number(purchaseForm.purchase_price) : undefined,
      expected_selling_price: purchaseForm.expected_selling_price ? Number(purchaseForm.expected_selling_price) : undefined,
      notes: optionalText(purchaseForm.notes),
      incoming_item: {
        brand: purchaseForm.incoming_brand,
        model: purchaseForm.incoming_model,
        imei: optionalText(purchaseForm.incoming_imei),
        color: optionalText(purchaseForm.incoming_color),
        storage: optionalText(purchaseForm.incoming_storage),
        purchase_price: purchaseForm.purchase_price ? Number(purchaseForm.purchase_price) : undefined,
        selling_price: purchaseForm.expected_selling_price ? Number(purchaseForm.expected_selling_price) : undefined,
        notes: optionalText(purchaseForm.notes),
      },
    }
  }

  function resetSaleForms() {
    setEditingSale(null)
    setSaleForm({ inventory_item_id: '', payment_method: 'cash', selling_price: '' })
    setStockOptionSearch('')
  }

  function resetExchangeForm() {
    setStockOptionSearch('')
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
      second_incoming_enabled: false,
      second_incoming_brand: '',
      second_incoming_model: '',
      second_incoming_imei: '',
      second_incoming_color: '',
      second_incoming_storage: '',
      second_incoming_purchase_price: '',
      second_incoming_selling_price: '',
    })
  }

  function resetPurchaseForm() {
    setEditingPurchase(null)
    setPurchaseForm({
      purchase_price: '',
      expected_selling_price: '',
      notes: '',
      incoming_brand: '',
      incoming_model: '',
      incoming_imei: '',
      incoming_color: '',
      incoming_storage: '',
    })
  }

  function logout() {
    localStorage.removeItem('stoku_token')
    setToken('')
    setStores([])
    setInventory([])
    setAvailableInventory([])
    setReportSales([])
    setExchanges([])
    setInventoryMeta(emptyPaginationMeta)
    setSalesMeta(emptyPaginationMeta)
    setExchangesMeta(emptyPaginationMeta)
    setPurchasesMeta(emptyPaginationMeta)
    setInventorySummary(emptyInventorySummary)
    setInventoryPage(1)
    setSalesPage(1)
    setExchangesPage(1)
    setPurchasesPage(1)
    setStockOptionSearch('')
    setUsers([])
    setSales([])
    setPurchases([])
    setCurrentUser(null)
    setNotice('Dolët nga sistemi.')
  }

  async function exportInventory() {
    try {
      const header = ['IMEI', 'Produkti', 'Ngjyra', 'Memoria', 'Kosto', 'Çmimi', 'Shitur për', 'Statusi']
      setNotice('Duke përgatitur eksportin e inventarit...')
      const exportRows = await loadAllPages<InventoryApiItem>(inventoryFilterPath(), 100)
      const rows = exportRows.map((item) => [item.imei ?? 'Nuk ka', `${item.brand} ${item.model}`, item.color ?? '', item.storage ?? '', item.purchase_price, item.selling_price, item.sold_price ?? '', statusLabel(item.status)])
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
      downloadUtf8Blob(csv, 'inventari-stoku.csv', 'text/csv;charset=utf-8;')
      setNotice(`Inventari u eksportua si CSV (${exportRows.length} artikuj).`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Eksporti i inventarit dështoi.')
    }
  }

  async function updateInventoryStatus(itemId: number, status: string) {
    if (!selectedStoreId) return

    try {
      await api(`${activeStorePath}/inventory/${itemId}/adjust`, {
        body: JSON.stringify({ status, notes: 'Statusi u ndryshua nga paneli' }),
        method: 'POST',
      })
      setNotice('Statusi i artikullit u përditësua.')
      await loadStoreData()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Përditësimi i statusit dështoi.')
    }
  }

  function selectStore(storeId: number) {
    setInventoryPage(1)
    setSalesPage(1)
    setExchangesPage(1)
    setPurchasesPage(1)
    setSelectedStoreId(storeId)
  }

  if (!token) {
    return <LoginScreen form={loginForm} isLoading={isLoading} onChange={setLoginForm} onSubmit={login} notice={notice} />
  }

  const metrics = [
    { label: 'Vlera e stokut', value: formatEuro(stockValue), delta: `${inventorySummary.total_items} artikuj`, icon: Boxes },
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
                <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => selectStore(Number(event.target.value))} value={selectedStoreId ?? ''}>
                  {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
                </select>
                {isSuperAdmin && (
                  <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={() => setModalMode('store')} type="button">
                    <Store size={17} />
                    Dyqan i ri
                  </button>
                )}
                <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" onClick={() => { resetInventoryForm(); setModalMode('inventory') }} type="button">
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
              <InventoryTable inventory={inventory} meta={inventoryMeta} onEditInventory={openEditInventory} onExport={exportInventory} onPageChange={setInventoryPage} onPerPageChange={setInventoryPerPage} onSearchChange={setSearch} onStatusChange={updateInventoryStatus} perPage={inventoryPerPage} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
            </>
          )}
          {activeView === 'Inventari' && <InventoryTable inventory={inventory} meta={inventoryMeta} onEditInventory={openEditInventory} onExport={exportInventory} onPageChange={setInventoryPage} onPerPageChange={setInventoryPerPage} onSearchChange={setSearch} onStatusChange={updateInventoryStatus} perPage={inventoryPerPage} search={search} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />}
          {activeView === 'Shitjet' && <SalesView isSuperAdmin={isSuperAdmin} meta={salesMeta} onDeleteSale={deleteSale} onEditSale={openEditSale} onPageChange={loadSalesData} onPerPageChange={(perPage) => { setSalesPerPage(perPage); void loadSalesData(1, perPage) }} sales={sales} stockCount={stockCount} onOpenSale={() => { setAvailableInventory([]); resetSaleForms(); setModalMode('sale') }} perPage={salesPerPage} />}
          {activeView === 'Ndërrimet' && <ExchangeView exchanges={exchanges} meta={exchangesMeta} onPageChange={loadExchangesData} onPerPageChange={(perPage) => { setExchangesPerPage(perPage); void loadExchangesData(1, perPage) }} stockCount={stockCount} onOpenExchange={() => { setAvailableInventory([]); setStockOptionSearch(''); setModalMode('exchange') }} perPage={exchangesPerPage} />}
          {activeView === 'Blerjet' && <PurchasesView isSuperAdmin={isSuperAdmin} meta={purchasesMeta} onDeletePurchase={deletePurchase} onEditPurchase={openEditPurchase} onPageChange={loadPurchasesData} onPerPageChange={(perPage) => { setPurchasesPerPage(perPage); void loadPurchasesData(1, perPage) }} purchases={purchases} onOpenPurchase={() => { resetPurchaseForm(); setModalMode('purchase') }} perPage={purchasesPerPage} />}
          {activeView === 'Arka' && <CashView cash={cash} onOpenCash={(type) => { setCashForm((form) => ({ ...form, type })); setModalMode('cash') }} />}
          {activeView === 'Raportet' && <ReportsView period={reportPeriod} range={reportRange} sales={reportSales} setPeriod={changeReportPeriod} setRange={changeReportRange} />}
          {activeView === 'Përdoruesit' && <UsersView users={users} onDeleteUser={deleteUser} onEditUser={openEditUser} onOpenUser={() => setModalMode('user')} />}
          {activeView === 'Historiku' && <InfoPanel title="Historiku" text="Audit log ruhet në backend për login, inventar, shitje, arkë dhe përdorues." />}
        </div>
      </section>

      {modalMode === 'inventory' && (
        <Modal title="Shto artikull të ri" onClose={() => { setModalMode(null); resetInventoryForm() }}>
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
            <SubmitRow submitLabel="Ruaj artikullin" onCancel={() => { setModalMode(null); resetInventoryForm() }} />
          </form>
        </Modal>
      )}

      {modalMode === 'editInventory' && (
        <Modal title="Edito artikull" onClose={() => { setModalMode(null); resetInventoryForm() }}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={updateInventoryItem}>
            <Field label="Brendi" value={inventoryForm.brand} onChange={(value) => setInventoryForm((form) => ({ ...form, brand: value }))} />
            <Field label="Modeli" value={inventoryForm.model} onChange={(value) => setInventoryForm((form) => ({ ...form, model: value }))} />
            <Field label="IMEI" value={inventoryForm.imei} onChange={(value) => setInventoryForm((form) => ({ ...form, imei: value }))} />
            <Field label="Ngjyra" value={inventoryForm.color} onChange={(value) => setInventoryForm((form) => ({ ...form, color: value }))} />
            <Field label="Memoria" value={inventoryForm.storage} onChange={(value) => setInventoryForm((form) => ({ ...form, storage: value }))} />
            <Field label="Çmimi i blerjes" value={inventoryForm.purchase_price} onChange={(value) => setInventoryForm((form) => ({ ...form, purchase_price: value }))} />
            <Field label="Çmimi i shitjes" value={inventoryForm.selling_price} onChange={(value) => setInventoryForm((form) => ({ ...form, selling_price: value }))} />
            <Field label="Data e hyrjes" type="date" value={inventoryForm.date_added} onChange={(value) => setInventoryForm((form) => ({ ...form, date_added: value }))} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Statusi</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setInventoryForm((form) => ({ ...form, status: event.target.value }))} value={inventoryForm.status}>
                <option value="in_stock">Në stok</option>
                <option value="reserved">Rezervuar</option>
                <option value="damaged">Dëmtuar</option>
                <option value="returned">Kthyer</option>
                {(inventoryForm.status === 'sold' || inventoryForm.status === 'exchanged_out') && <option value={inventoryForm.status}>{statusLabel(inventoryForm.status)}</option>}
              </select>
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Shënim</span>
              <textarea className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600" onChange={(event) => setInventoryForm((form) => ({ ...form, notes: event.target.value }))} value={inventoryForm.notes} />
            </label>
            <SubmitRow submitLabel="Ruaj ndryshimet" onCancel={() => { setModalMode(null); resetInventoryForm() }} />
          </form>
        </Modal>
      )}

      {modalMode === 'store' && (
        <Modal title="Krijo dyqan të ri" onClose={() => setModalMode(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createStore}>
            <Field label="Emri i dyqanit" value={storeForm.name} onChange={(value) => setStoreForm((form) => ({ ...form, name: value }))} />
            <Field label="Adresa" value={storeForm.address} onChange={(value) => setStoreForm((form) => ({ ...form, address: value }))} />
            <Field label="Telefoni" value={storeForm.phone} onChange={(value) => setStoreForm((form) => ({ ...form, phone: value }))} />
            <Field label="Email i dyqanit" type="email" value={storeForm.email} onChange={(value) => setStoreForm((form) => ({ ...form, email: value }))} />
            <Field label="Valuta" value={storeForm.currency} onChange={(value) => setStoreForm((form) => ({ ...form, currency: value.toUpperCase().slice(0, 3) }))} />
            <Field label="Zona kohore" value={storeForm.timezone} onChange={(value) => setStoreForm((form) => ({ ...form, timezone: value }))} />
            <SubmitRow submitLabel="Krijo dyqanin" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {modalMode === 'user' && (
        <Modal title="Shto ose lidh përdorues" onClose={() => setModalMode(null)}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={createUser}>
            <Field label="Emri" value={userForm.name} onChange={(value) => setUserForm((form) => ({ ...form, name: value }))} />
            <Field label="Email" value={userForm.email} onChange={(value) => setUserForm((form) => ({ ...form, email: value }))} />
            <Field label="Fjalëkalimi" type="password" value={userForm.password} onChange={(value) => setUserForm((form) => ({ ...form, password: value }))} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Roli</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setUserForm((form) => ({ ...form, role: event.target.value }))} value={userForm.role}>
                <option value="employee">Punëtor</option>
                <option value="store_owner">Admin / pronar dyqani</option>
                {isSuperAdmin && <option value="super_admin">Super admin</option>}
              </select>
            </label>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">Nëse email-i ekziston, përdoruesi lidhet me këtë dyqan. Për përdorues të ri, plotëso emrin dhe fjalëkalimin.</p>
            <SubmitRow submitLabel="Ruaj përdoruesin" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {modalMode === 'editUser' && (
        <Modal title="Edito përdorues" onClose={() => { setModalMode(null); setEditingUser(null); resetUserForm() }}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={updateUser}>
            <Field label="Emri" value={userForm.name} onChange={(value) => setUserForm((form) => ({ ...form, name: value }))} />
            <Field label="Email" value={userForm.email} onChange={(value) => setUserForm((form) => ({ ...form, email: value }))} />
            <Field label="Fjalëkalimi" type="password" value={userForm.password} onChange={(value) => setUserForm((form) => ({ ...form, password: value }))} />
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Roli</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setUserForm((form) => ({ ...form, role: event.target.value }))} value={userForm.role}>
                <option value="employee">Punëtor</option>
                <option value="store_owner">Admin / pronar dyqani</option>
                {isSuperAdmin && <option value="super_admin">Super admin</option>}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Statusi</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setUserForm((form) => ({ ...form, status: event.target.value }))} value={userForm.status}>
                <option value="active">Aktiv</option>
                <option value="inactive">Joaktiv</option>
              </select>
            </label>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 sm:col-span-2">Lëre fjalëkalimin bosh nëse nuk dëshiron ta ndryshosh.</p>
            <SubmitRow submitLabel="Ruaj ndryshimet" onCancel={() => { setModalMode(null); setEditingUser(null); resetUserForm() }} />
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

      {(modalMode === 'sale' || modalMode === 'editSale') && (
        <Modal title={modalMode === 'editSale' ? 'Edito shitje' : 'Regjistro shitje'} onClose={() => { setModalMode(null); resetSaleForms() }}>
          <form className="grid gap-3" onSubmit={modalMode === 'editSale' ? updateSale : createSale}>
            {modalMode === 'sale' ? (
              <>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Kërko artikull</span>
                  <input className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600" onChange={(event) => setStockOptionSearch(event.target.value)} placeholder="IMEI, brend ose model" value={stockOptionSearch} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Artikulli</span>
                  <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setSaleForm((form) => ({ ...form, inventory_item_id: event.target.value }))} required value={saleForm.inventory_item_id}>
                    <option value="">Zgjidh artikullin</option>
                    {availableInventory.map((item) => <option key={item.id} value={item.id}>{inventoryOptionLabel(item)}</option>)}
                  </select>
                  {!availableInventory.length && <span className="block text-xs text-slate-500">Nuk ka artikuj në stok për këtë kërkim.</span>}
                </label>
              </>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <p className="font-semibold text-slate-900">{editingSale?.sale_number}</p>
                <p className="text-slate-600">{saleItemsLabel(editingSale ?? undefined)} · {editingSale ? new Date(editingSale.created_at).toLocaleString('sq-AL') : ''}</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Çmimi i shitjes" value={saleForm.selling_price} onChange={(value) => setSaleForm((form) => ({ ...form, selling_price: value }))} />
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Pagesa</span>
                <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setSaleForm((form) => ({ ...form, payment_method: event.target.value }))} value={saleForm.payment_method}>
                  <option value="cash">Cash</option>
                  <option value="card">Kartelë</option>
                  <option value="mixed">E përzier</option>
                  <option value="other">Tjetër</option>
                </select>
              </label>
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <p className="font-medium">Arka përditësohet automatikisht</p>
                <p className="text-xs">Në editim ruhet vetëm diferenca e çmimit.</p>
              </div>
            </div>
            <SubmitRow submitLabel={modalMode === 'editSale' ? 'Ruaj ndryshimet' : 'Regjistro shitjen'} onCancel={() => { setModalMode(null); resetSaleForms() }} />
          </form>
        </Modal>
      )}

      {modalMode === 'exchange' && (
        <Modal title="Regjistro ndërrim" onClose={() => setModalMode(null)}>
          <form className="grid gap-3" onSubmit={createExchange}>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Kërko telefonin që del</span>
              <input className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600" onChange={(event) => setStockOptionSearch(event.target.value)} placeholder="IMEI, brend ose model" value={stockOptionSearch} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Telefoni që del nga stoku</span>
              <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setExchangeForm((form) => ({ ...form, outgoing_item_id: event.target.value }))} required value={exchangeForm.outgoing_item_id}>
                <option value="">Zgjidh artikullin</option>
                {availableInventory.map((item) => <option key={item.id} value={item.id}>{inventoryOptionLabel(item)}</option>)}
              </select>
              {!availableInventory.length && <span className="block text-xs text-slate-500">Nuk ka artikuj në stok për këtë kërkim.</span>}
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
            <div className="rounded-md border border-slate-200 p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input checked={exchangeForm.second_incoming_enabled} onChange={(event) => setExchangeForm((form) => ({ ...form, second_incoming_enabled: event.target.checked }))} type="checkbox" />
                Klienti sjell edhe telefon të dytë
              </label>
              {exchangeForm.second_incoming_enabled && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Brendi hyrës 2" value={exchangeForm.second_incoming_brand} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_brand: value }))} />
                  <Field label="Modeli hyrës 2" value={exchangeForm.second_incoming_model} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_model: value }))} />
                  <Field label="IMEI 2" value={exchangeForm.second_incoming_imei} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_imei: value }))} />
                  <Field label="Ngjyra 2" value={exchangeForm.second_incoming_color} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_color: value }))} />
                  <Field label="Memoria 2" value={exchangeForm.second_incoming_storage} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_storage: value }))} />
                  <Field label="Vlera e blerjes hyrëse 2" value={exchangeForm.second_incoming_purchase_price} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_purchase_price: value }))} />
                  <Field label="Çmimi i shitjes hyrëse 2" value={exchangeForm.second_incoming_selling_price} onChange={(value) => setExchangeForm((form) => ({ ...form, second_incoming_selling_price: value }))} />
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">Drejtimi i cash-it</span>
                <select className="h-10 w-full rounded-md border border-slate-300 px-3" onChange={(event) => setExchangeForm((form) => ({ ...form, cash_direction: event.target.value }))} value={exchangeForm.cash_direction}>
                  <option value="customer_pays">Klienti paguan</option>
                  <option value="store_pays">Dyqani paguan</option>
                  <option value="none">Pa cash</option>
                </select>
              </label>
              <Field label="Shuma cash" value={exchangeForm.cash_difference} onChange={(value) => setExchangeForm((form) => ({ ...form, cash_difference: value }))} />
            </div>
            <Field label="Shënim" value={exchangeForm.notes} onChange={(value) => setExchangeForm((form) => ({ ...form, notes: value }))} />
            <SubmitRow submitLabel="Regjistro ndërrimin" onCancel={() => setModalMode(null)} />
          </form>
        </Modal>
      )}

      {(modalMode === 'purchase' || modalMode === 'editPurchase') && (
        <Modal title={modalMode === 'editPurchase' ? 'Edito blerje' : 'Regjistro blerje'} onClose={() => { setModalMode(null); resetPurchaseForm() }}>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={modalMode === 'editPurchase' ? updateCustomerPurchase : createCustomerPurchase}>
            <Field label="Brendi hyrës" value={purchaseForm.incoming_brand} onChange={(value) => setPurchaseForm((form) => ({ ...form, incoming_brand: value }))} />
            <Field label="Modeli hyrës" value={purchaseForm.incoming_model} onChange={(value) => setPurchaseForm((form) => ({ ...form, incoming_model: value }))} />
            <Field label="IMEI" value={purchaseForm.incoming_imei} onChange={(value) => setPurchaseForm((form) => ({ ...form, incoming_imei: value }))} />
            <Field label="Ngjyra" value={purchaseForm.incoming_color} onChange={(value) => setPurchaseForm((form) => ({ ...form, incoming_color: value }))} />
            <Field label="Memoria" value={purchaseForm.incoming_storage} onChange={(value) => setPurchaseForm((form) => ({ ...form, incoming_storage: value }))} />
            <Field label="Çmimi i blerjes" value={purchaseForm.purchase_price} onChange={(value) => setPurchaseForm((form) => ({ ...form, purchase_price: value }))} />
            <Field label="Çmimi i shitjes" value={purchaseForm.expected_selling_price} onChange={(value) => setPurchaseForm((form) => ({ ...form, expected_selling_price: value }))} />
            <Field label="Shënim" value={purchaseForm.notes} onChange={(value) => setPurchaseForm((form) => ({ ...form, notes: value }))} />
            <SubmitRow submitLabel={modalMode === 'editPurchase' ? 'Ruaj ndryshimet' : 'Regjistro blerjen'} onCancel={() => { setModalMode(null); resetPurchaseForm() }} />
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

function InventoryTable({
  inventory,
  meta,
  onEditInventory,
  onExport,
  onPageChange,
  onPerPageChange,
  onSearchChange,
  onStatusChange,
  perPage,
  search,
  setStatusFilter,
  statusFilter,
}: {
  inventory: InventoryApiItem[]
  meta: PaginationMeta
  onEditInventory: (item: InventoryApiItem) => void
  onExport: () => void
  onPageChange: (page: number) => void
  onPerPageChange: (perPage: number) => void
  onSearchChange: (search: string) => void
  onStatusChange: (itemId: number, status: string) => void
  perPage: number
  search: string
  setStatusFilter: (status: string) => void
  statusFilter: string
}) {
  const canGoBack = meta.current_page > 1
  const canGoForward = meta.current_page < meta.last_page

  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-200 px-4 py-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
            <input className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600" onChange={(event) => onSearchChange(event.target.value)} placeholder="Kërko IMEI, brend ose model" value={search} />
          </label>
          <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option>Të gjitha</option>
            <option>Në stok</option>
            <option>Rezervuar</option>
            <option>Shitur</option>
            <option>Dëmtuar</option>
            <option>Kthyer</option>
            <option>Dalë në ndërrim</option>
          </select>
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={onExport} type="button"><Download size={16} />Eksporto</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">IMEI</th>
              <th className="px-4 py-3 font-medium">Produkti</th>
              <th className="px-4 py-3 font-medium">Ngjyra</th>
              <th className="px-4 py-3 font-medium">Memoria</th>
              <th className="px-4 py-3 font-medium">Kosto</th>
              <th className="px-4 py-3 font-medium">Çmimi</th>
              <th className="px-4 py-3 font-medium">Shitur për</th>
              <th className="px-4 py-3 font-medium">Statusi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {inventory.map((item) => (
              <tr className="hover:bg-slate-50" key={item.id}>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.imei ?? 'Nuk ka'}</td>
                <td className="px-4 py-3">
                  <button className="text-left font-semibold text-blue-700 hover:text-blue-900 hover:underline" onClick={() => onEditInventory(item)} type="button">{item.brand} {item.model}</button>
                </td>
                <td className="px-4 py-3">{item.color ?? '-'}</td>
                <td className="px-4 py-3">{item.storage ?? '-'}</td>
                <td className="px-4 py-3">{formatEuro(Number(item.purchase_price))}</td>
                <td className="px-4 py-3 font-semibold">{formatEuro(Number(item.selling_price))}</td>
                <td className="px-4 py-3 font-semibold text-emerald-700">{item.sold_price ? formatEuro(Number(item.sold_price)) : '-'}</td>
                <td className="px-4 py-3">
                  <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700" disabled={item.status === 'sold' || item.status === 'exchanged_out'} onChange={(event) => onStatusChange(item.id, event.target.value)} value={item.status}>
                    <option value="in_stock">Në stok</option>
                    <option value="reserved">Rezervuar</option>
                    <option value="damaged">Dëmtuar</option>
                    <option value="returned">Kthyer</option>
                    {(item.status === 'sold' || item.status === 'exchanged_out') && <option value={item.status}>{statusLabel(item.status)}</option>}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!inventory.length && <p className="px-4 py-6 text-sm text-slate-500">Nuk ka artikuj për këtë kërkim ose filtër.</p>}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">Faqja {meta.current_page} / {meta.last_page} · {meta.total} rezultate</p>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => onPerPageChange(Number(event.target.value))} value={perPage}>
            <option value={10}>10 / faqe</option>
            <option value={20}>20 / faqe</option>
            <option value={50}>50 / faqe</option>
            <option value={100}>100 / faqe</option>
          </select>
          <PaginationButtons canGoBack={canGoBack} canGoForward={canGoForward} currentPage={meta.current_page} lastPage={meta.last_page} onPageChange={onPageChange} />
        </div>
      </div>
    </section>
  )
}

function SalesView({ isSuperAdmin, meta, onDeleteSale, onEditSale, onOpenSale, onPageChange, onPerPageChange, perPage, sales, stockCount }: { isSuperAdmin: boolean; meta: PaginationMeta; onDeleteSale: (sale: SaleApiRecord) => void; onEditSale: (sale: SaleApiRecord) => void; onOpenSale: () => void; onPageChange: (page: number) => void; onPerPageChange: (perPage: number) => void; perPage: number; sales: SaleApiRecord[]; stockCount: number }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold">Shitjet</h2><p className="text-sm text-slate-500">{stockCount} artikuj të gatshëm për shitje.</p></div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={onOpenSale} type="button"><ReceiptText size={16} />Regjistro shitje</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Fatura</th>
              <th className="px-4 py-3 font-medium">Artikulli</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Pagesa</th>
              <th className="px-4 py-3 text-right font-medium">Totali</th>
              <th className="px-4 py-3 text-right font-medium">Fitimi</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right font-medium">Veprime</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sales.map((sale) => (
              <tr className="hover:bg-slate-50/70" key={sale.id}>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{sale.sale_number}</p><p className="text-xs text-slate-500">{sale.type === 'normal' ? 'Shitje normale' : sale.type}</p></td>
                <td className="px-4 py-3">{saleItemDetails(sale)}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(sale.created_at).toLocaleString('sq-AL')}</td>
                <td className="px-4 py-3"><span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{paymentLabel(sale.payment_method)}</span></td>
                <td className="px-4 py-3 text-right font-semibold">{formatEuro(Number(sale.total))}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatEuro(Number(sale.profit))}</td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <ActionIconButton icon={Pencil} label="Edito" onClick={() => onEditSale(sale)} />
                      <ActionIconButton icon={Trash2} label="Fshi" onClick={() => onDeleteSale(sale)} tone="danger" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!sales.length && <p className="px-4 py-6 text-sm text-slate-500">Ende nuk ka shitje të regjistruara.</p>}
      <TablePagination meta={meta} onPageChange={onPageChange} onPerPageChange={onPerPageChange} perPage={perPage} />
    </section>
  )
}

function ReportsView({ period, range, sales, setPeriod, setRange }: { period: ReportPeriod; range: { from: string; to: string }; sales: SaleApiRecord[]; setPeriod: (period: ReportPeriod) => void; setRange: (range: { from: string; to: string }) => void }) {
  const report = buildSalesReport(sales)
  const reportTitle = `Raporti i shitjeve - ${reportPeriodLabel(period)}`
  const periodText = reportPeriodRangeLabel(period, range)

  function exportExcel() {
    downloadUtf8Blob(salesReportHtml(reportTitle, periodText, report), `raporti-shitjeve-${period}-${todayInputValue()}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
  }

  function exportPdf() {
    const printable = window.open('', '_blank', 'width=960,height=720')
    if (!printable) return

    printable.document.write(salesReportHtml(reportTitle, periodText, report))
    printable.document.close()
    printable.focus()
    printable.print()
  }

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-base font-semibold">Raportet e shitjeve</h2><p className="text-sm text-slate-500">{periodText} · Gjeneruar më {new Date().toLocaleString('sq-AL')}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setPeriod(event.target.value as ReportPeriod)} value={period}>
              <option value="daily">Ditore</option>
              <option value="weekly">Javore</option>
              <option value="monthly">Mujore</option>
              <option value="custom">Periudhë e personalizuar</option>
            </select>
            {period === 'custom' && (
              <>
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setRange({ ...range, from: event.target.value })} type="date" value={range.from} />
                <input className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => setRange({ ...range, to: event.target.value })} type="date" value={range.to} />
              </>
            )}
            <button className="h-10 rounded-md border border-slate-300 px-3 text-sm font-medium hover:bg-slate-50" onClick={exportExcel} type="button">Excel</button>
            <button className="h-10 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700" onClick={exportPdf} type="button">PDF</button>
          </div>
        </div>
      </div>
      <section className="grid gap-3 md:grid-cols-4">
        <ReportMetric label="Shitje" value={report.count.toString()} />
        <ReportMetric label="Qarkullimi" value={formatEuro(report.total)} />
        <ReportMetric label="Fitimi" value={formatEuro(report.profit)} tone="emerald" />
        <ReportMetric label="Marzha" value={formatPercent(report.margin)} />
        <ReportMetric label="Kosto" value={formatEuro(report.cost)} />
        <ReportMetric label="Mesatarja / faturë" value={formatEuro(report.averageSale)} />
        <ReportMetric label="Artikuj të shitur" value={report.itemsSold.toString()} />
        <ReportMetric label="Zbritje" value={formatEuro(report.discount)} />
      </section>
      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Pagesat</h2>
          <div className="mt-3 space-y-3">{report.paymentRows.map((row) => <div key={row.label}><div className="flex justify-between text-sm"><span>{row.label}</span><strong>{formatEuro(row.total)}</strong></div><div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${row.share}%` }} /></div><p className="mt-1 text-xs text-slate-500">{row.count} fatura · {formatPercent(row.share)}</p></div>)}{!report.paymentRows.length && <p className="text-sm text-slate-500">Nuk ka të dhëna.</p>}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Shitjet sipas ditëve</h2>
          <div className="mt-3 divide-y">{report.dailyRows.map((row) => <div className="flex items-center justify-between gap-3 py-2" key={row.date}><div><p className="text-sm font-medium">{row.date}</p><p className="text-xs text-slate-500">{row.count} fatura</p></div><strong className="text-sm">{formatEuro(row.total)}</strong></div>)}{!report.dailyRows.length && <p className="text-sm text-slate-500">Nuk ka të dhëna.</p>}</div>
        </article>
        <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold">Produktet kryesore</h2>
          <div className="mt-3 divide-y">{report.productRows.slice(0, 6).map((row) => <div className="flex items-center justify-between gap-3 py-2" key={row.description}><div><p className="text-sm font-medium">{row.description}</p><p className="text-xs text-slate-500">{row.quantity} copë · fitimi {formatEuro(row.profit)}</p></div><strong className="text-sm">{formatEuro(row.total)}</strong></div>)}{!report.productRows.length && <p className="text-sm text-slate-500">Nuk ka të dhëna.</p>}</div>
        </article>
      </section>
      <section className="rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3"><CalendarDays className="text-slate-400" size={18} /><h2 className="text-base font-semibold">Detajet</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Fatura</th><th className="px-4 py-3 font-medium">Artikulli</th><th className="px-4 py-3 font-medium">Pagesa</th><th className="px-4 py-3 font-medium">Kosto</th><th className="px-4 py-3 font-medium">Totali</th><th className="px-4 py-3 font-medium">Fitimi</th><th className="px-4 py-3 font-medium">Marzha</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((sale) => <tr key={sale.id}><td className="px-4 py-3">{new Date(sale.created_at).toLocaleString('sq-AL')}</td><td className="px-4 py-3 font-medium">{sale.sale_number}</td><td className="px-4 py-3">{saleItemsLabel(sale)}</td><td className="px-4 py-3">{paymentLabel(sale.payment_method)}</td><td className="px-4 py-3">{formatEuro(saleCost(sale))}</td><td className="px-4 py-3 font-semibold">{formatEuro(Number(sale.total))}</td><td className="px-4 py-3 text-emerald-700">{formatEuro(Number(sale.profit))}</td><td className="px-4 py-3">{formatPercent(saleMargin(sale))}</td></tr>)}
              {!sales.length && <tr><td className="px-4 py-6 text-slate-500" colSpan={8}>Nuk ka shitje për këtë periudhë.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function ExchangeView({ exchanges, meta, onOpenExchange, onPageChange, onPerPageChange, perPage, stockCount }: { exchanges: ExchangeApiRecord[]; meta: PaginationMeta; onOpenExchange: () => void; onPageChange: (page: number) => void; onPerPageChange: (perPage: number) => void; perPage: number; stockCount: number }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold">Ndërrimet</h2><p className="text-sm text-slate-500">{stockCount} telefona në stok · çdo rresht tregon çka doli dhe çka hyri.</p></div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={onOpenExchange} type="button"><Repeat2 size={16} />Regjistro ndërrim</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Doli nga dyqani</th>
              <th className="px-4 py-3 font-medium">Hyri nga klienti</th>
              <th className="px-4 py-3 font-medium">Cash</th>
              <th className="px-4 py-3 text-right font-medium">Fitim/Humbje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {exchanges.map((exchange) => (
              <tr className="align-top hover:bg-slate-50/70" key={exchange.id}>
                <td className="px-4 py-3 text-slate-600">{new Date(exchange.created_at).toLocaleString('sq-AL')}</td>
                <td className="px-4 py-3">{inventoryItemLabel(exchange.outgoing_item)}</td>
                <td className="px-4 py-3"><div className="space-y-2">{exchangeIncomingItems(exchange).map((item, index) => <div className="rounded-md bg-slate-50 px-2 py-1" key={`${item?.id ?? index}-${index}`}>{inventoryItemLabel(item)}</div>)}</div></td>
                <td className="px-4 py-3">{exchangeCashLabel(exchange)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${exchangeProfitLoss(exchange) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatEuro(exchangeProfitLoss(exchange))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!exchanges.length && <p className="px-4 py-6 text-sm text-slate-500">Ende nuk ka ndërrime të regjistruara.</p>}
      <TablePagination meta={meta} onPageChange={onPageChange} onPerPageChange={onPerPageChange} perPage={perPage} />
    </section>
  )
}

function PurchasesView({ isSuperAdmin, meta, onDeletePurchase, onEditPurchase, onOpenPurchase, onPageChange, onPerPageChange, perPage, purchases }: { isSuperAdmin: boolean; meta: PaginationMeta; onDeletePurchase: (purchase: PurchaseApiRecord) => void; onEditPurchase: (purchase: PurchaseApiRecord) => void; onOpenPurchase: () => void; onPageChange: (page: number) => void; onPerPageChange: (perPage: number) => void; perPage: number; purchases: PurchaseApiRecord[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-semibold">Blerjet</h2><p className="text-sm text-slate-500">Telefona që klientët ia shesin dyqanit. Hyn stok, del cash.</p></div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" onClick={onOpenPurchase} type="button"><HandCoins size={16} />Regjistro blerje</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Dokumenti</th>
              <th className="px-4 py-3 font-medium">Telefoni</th>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 text-right font-medium">Paguar</th>
              <th className="px-4 py-3 text-right font-medium">Çmimi i synuar</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right font-medium">Veprime</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => (
              <tr className="hover:bg-slate-50/70" key={purchase.id}>
                <td className="px-4 py-3"><p className="font-semibold text-slate-900">{purchase.purchase_number}</p><p className="text-xs text-slate-500">Blerje nga klienti</p></td>
                <td className="px-4 py-3">{inventoryItemLabel(purchase.item)}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(purchase.created_at).toLocaleString('sq-AL')}</td>
                <td className="px-4 py-3 text-right font-semibold text-rose-700">{formatEuro(Number(purchase.purchase_price))}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatEuro(Number(purchase.expected_selling_price))}</td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <ActionIconButton icon={Pencil} label="Edito" onClick={() => onEditPurchase(purchase)} />
                      <ActionIconButton icon={Trash2} label="Fshi" onClick={() => onDeletePurchase(purchase)} tone="danger" />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!purchases.length && <p className="px-4 py-6 text-sm text-slate-500">Ende nuk ka blerje të regjistruara.</p>}
      <TablePagination meta={meta} onPageChange={onPageChange} onPerPageChange={onPerPageChange} perPage={perPage} />
    </section>
  )
}

function CashView({ cash, onOpenCash }: { cash: CashState; onOpenCash: (type: string) => void }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold">Arka</h2><p className="text-sm text-slate-500">Gjendja aktuale: {formatEuro(Number(cash.register?.current_balance ?? 0))}</p></div><div className="flex gap-2"><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('deposit')} type="button">Depozitim</button><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('withdraw')} type="button">Tërheqje</button><button className="rounded-md border px-3 py-2 text-sm" onClick={() => onOpenCash('expense')} type="button">Shpenzim</button></div></div></section>
}

function TablePagination({ meta, onPageChange, onPerPageChange, perPage }: { meta: PaginationMeta; onPageChange: (page: number) => void; onPerPageChange: (perPage: number) => void; perPage: number }) {
  const canGoBack = meta.current_page > 1
  const canGoForward = meta.current_page < meta.last_page

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">Faqja {meta.current_page} / {meta.last_page} · {meta.total} rezultate</p>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <select className="h-10 rounded-md border border-slate-300 px-3 text-sm" onChange={(event) => onPerPageChange(Number(event.target.value))} value={perPage}>
          <option value={10}>10 / faqe</option>
          <option value={20}>20 / faqe</option>
          <option value={50}>50 / faqe</option>
          <option value={100}>100 / faqe</option>
        </select>
        <PaginationButtons canGoBack={canGoBack} canGoForward={canGoForward} currentPage={meta.current_page} lastPage={meta.last_page} onPageChange={onPageChange} />
      </div>
    </div>
  )
}

function PaginationButtons({ canGoBack, canGoForward, currentPage, lastPage, onPageChange }: { canGoBack: boolean; canGoForward: boolean; currentPage: number; lastPage: number; onPageChange: (page: number) => void }) {
  const buttonClass = 'h-10 rounded-md border border-slate-300 px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 hover:bg-slate-50'

  return (
    <>
      <button className={buttonClass} disabled={!canGoBack} onClick={() => onPageChange(1)} type="button">Fillimi</button>
      <button className={buttonClass} disabled={!canGoBack} onClick={() => onPageChange(currentPage - 1)} type="button">Mbrapa</button>
      <button className={buttonClass} disabled={!canGoForward} onClick={() => onPageChange(currentPage + 1)} type="button">Përpara</button>
      <button className={buttonClass} disabled={!canGoForward} onClick={() => onPageChange(lastPage)} type="button">Fundi</button>
    </>
  )
}

function UsersView({ onDeleteUser, onEditUser, onOpenUser, users }: { onDeleteUser: (user: StoreUser) => void; onEditUser: (user: StoreUser) => void; onOpenUser: () => void; users: StoreUser[] }) {
  return <section className="rounded-md border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b px-4 py-3"><div><h2 className="text-base font-semibold">Përdoruesit</h2><p className="text-sm text-slate-500">{users.length} përdorues në dyqan/platformë.</p></div><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white" onClick={onOpenUser} type="button">Shto përdorues</button></div><div className="divide-y">{users.map((user) => <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" key={user.id}><div><p className="font-medium">{user.name}</p><p className="text-sm text-slate-500">{user.email}</p></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs">{user.status === 'active' ? 'Aktiv' : 'Joaktiv'}</span><span className="text-xs font-medium text-slate-500">{roleLabel(userRoleValue(user))}</span><button className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50" onClick={() => onEditUser(user)} type="button">Edito</button><button className="rounded-md border border-rose-200 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50" onClick={() => onDeleteUser(user)} type="button">Hiq</button></div></div>)}</div></section>
}

function InfoPanel({ text, title }: { text: string; title: string }) {
  return <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-base font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></section>
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-md bg-white shadow-xl"><div className="flex items-center justify-between border-b px-4 py-3"><h2 className="text-base font-semibold">{title}</h2><button className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button></div><div className="max-h-[calc(92vh-57px)] overflow-y-auto p-4">{children}</div></div></div>
}

function ActionIconButton({ icon: Icon, label, onClick, tone = 'neutral' }: { icon: typeof Pencil; label: string; onClick: () => void; tone?: 'neutral' | 'danger' }) {
  const className = tone === 'danger'
    ? 'inline-flex h-9 items-center gap-1 rounded-md border border-rose-200 px-2 text-xs font-medium text-rose-700 hover:bg-rose-50'
    : 'inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50'

  return <button className={className} onClick={onClick} type="button"><Icon size={14} />{label}</button>
}

function Field({ label, onChange, type = 'text', value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  const optionalLabels = ['IMEI', 'IMEI 2', 'Shënim', 'Ngjyra', 'Ngjyra 2', 'Memoria', 'Memoria 2', 'Data e hyrjes', 'Vlera e telefonit që del', 'Emri', 'Fjalëkalimi', 'Adresa', 'Telefoni', 'Email i dyqanit', 'Çmimi i blerjes', 'Çmimi i shitjes', 'Vlera e blerjes hyrëse', 'Vlera e blerjes hyrëse 2', 'Çmimi i shitjes hyrëse', 'Çmimi i shitjes hyrëse 2']

  return <label className="space-y-1 text-sm"><span className="font-medium text-slate-700">{label}</span><input className="h-10 w-full rounded-md border border-slate-300 px-3 outline-none focus:border-blue-600" onChange={(event) => onChange(event.target.value)} required={!optionalLabels.includes(label)} type={type} value={value} /></label>
}

function SubmitRow({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 sm:col-span-2"><button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50" onClick={onCancel} type="button">Anulo</button><button className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" type="submit">{submitLabel}</button></div>
}

function statusLabel(status: string) {
  return ({ in_stock: 'Në stok', reserved: 'Rezervuar', sold: 'Shitur', damaged: 'Dëmtuar', exchanged_out: 'Dalë në ndërrim', returned: 'Kthyer' } as Record<string, string>)[status] ?? status
}

function inventoryStatusValue(label: string) {
  return ({ 'Në stok': 'in_stock', Rezervuar: 'reserved', Shitur: 'sold', Dëmtuar: 'damaged', 'Dalë në ndërrim': 'exchanged_out', Kthyer: 'returned' } as Record<string, string>)[label] ?? ''
}

function paginationMeta<T>(page: PaginatedApiResponse<T>): PaginationMeta {
  return {
    current_page: page.current_page,
    last_page: page.last_page,
    per_page: Number(page.per_page),
    total: page.total,
    from: page.from,
    to: page.to,
  }
}

function cashTypeLabel(type: string) {
  return ({ manual_deposit: 'Depozitim', manual_withdrawal: 'Tërheqje', expense: 'Shpenzim', sale_income: 'Shitje', sale_adjustment: 'Korrigjim shitjeje', sale_reversal: 'Kthim/fshirje shitjeje', exchange_income: 'Ndërrim hyrje', exchange_payout: 'Ndërrim dalje', customer_purchase_payout: 'Blerje nga klienti', customer_purchase_adjustment: 'Korrigjim blerjeje', customer_purchase_reversal: 'Kthim/fshirje blerjeje' } as Record<string, string>)[type] ?? type
}

function paymentLabel(method: string) {
  return ({ cash: 'Cash', card: 'Kartelë', mixed: 'E përzier', other: 'Tjetër' } as Record<string, string>)[method] ?? method
}

function userRoleValue(user: StoreUser) {
  if (user.roles?.some((role) => role.name === 'super_admin' && role.scope === 'platform')) {
    return 'super_admin'
  }

  return user.roles?.find((role) => role.scope === 'store')?.name ?? 'employee'
}

function roleLabel(role?: string) {
  return ({ super_admin: 'Super admin', store_owner: 'Admin/pronar dyqani', employee: 'Punëtor' } as Record<string, string>)[role ?? ''] ?? 'Pa rol'
}

function inventoryOptionLabel(item: InventoryApiItem) {
  return `${item.brand} ${item.model} · IMEI: ${item.imei ?? 'Pa IMEI'} · ${formatEuro(Number(item.selling_price))}`
}

function inventoryItemLabel(item?: InventoryApiItem | null) {
  if (!item) return <span className="text-slate-500">Nuk ka të dhëna</span>

  return (
    <div>
      <p className="font-semibold text-slate-900">{item.brand} {item.model}</p>
      <p className="text-xs text-slate-500">IMEI: {item.imei ?? 'Pa IMEI'}{item.storage ? ` · ${item.storage}` : ''}{item.color ? ` · ${item.color}` : ''}</p>
    </div>
  )
}

function salePrimaryItem(sale?: SaleApiRecord | null) {
  return sale?.items?.[0]
}

function saleItemDetails(sale: SaleApiRecord) {
  const item = salePrimaryItem(sale)

  if (item?.inventory_item) return inventoryItemLabel(item.inventory_item)

  return (
    <div>
      <p className="font-semibold text-slate-900">{saleItemsLabel(sale)}</p>
      <p className="text-xs text-slate-500">{item?.inventory_item_id ? `ID stoku: ${item.inventory_item_id}` : 'Pa lidhje stoku'}</p>
    </div>
  )
}

function exchangeIncomingItems(exchange: ExchangeApiRecord) {
  const rows = exchange.incoming_items?.map((incoming) => incoming.item).filter(Boolean) as InventoryApiItem[] | undefined

  if (rows?.length) return rows
  if (exchange.incoming_item) return [exchange.incoming_item]

  return []
}

function exchangeCashLabel(exchange: ExchangeApiRecord) {
  const amount = formatEuro(Number(exchange.cash_difference))

  if (exchange.cash_direction === 'customer_pays') {
    return <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Klienti pagoi {amount}</span>
  }

  if (exchange.cash_direction === 'store_pays') {
    return <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">Dyqani pagoi {amount}</span>
  }

  return <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Pa cash</span>
}

function exchangeProfitLoss(exchange: ExchangeApiRecord) {
  return exchange.cash_direction === 'customer_pays'
    ? Number(exchange.cash_difference)
    : exchange.cash_direction === 'store_pays'
      ? -Number(exchange.cash_difference)
      : 0
}

function reportPeriodLabel(period: ReportPeriod) {
  return ({ daily: 'Ditor', weekly: 'Javor', monthly: 'Mujor', custom: 'Periudhë e personalizuar' } as Record<ReportPeriod, string>)[period]
}

function reportPeriodRangeLabel(period: ReportPeriod, range: { from: string; to: string }) {
  const effectiveRange = reportRangeForPeriod(period, range)
  const rangeText = `${formatDateLabel(effectiveRange.from)} - ${formatDateLabel(effectiveRange.to)}`

  if (period === 'daily') return `Sot, ${formatDateLabel(effectiveRange.from)}`
  if (period === 'weekly') return `7 ditët e fundit: ${rangeText}`
  if (period === 'monthly') return `Muaji aktual: ${rangeText}`

  return rangeText
}

function ReportMetric({ label, tone = 'slate', value }: { label: string; tone?: 'slate' | 'emerald'; value: string }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : 'text-slate-950'

  return <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><strong className={`mt-2 block text-2xl font-semibold ${toneClass}`}>{value}</strong></article>
}

function reportRows(sales: SaleApiRecord[]) {
  return sales.map((sale) => [
    new Date(sale.created_at).toLocaleString('sq-AL'),
    sale.sale_number,
    saleItemsLabel(sale),
    paymentLabel(sale.payment_method),
    formatEuro(saleCost(sale)),
    formatEuro(Number(sale.total)),
    formatEuro(Number(sale.profit)),
    formatPercent(saleMargin(sale)),
  ])
}

function saleItemsLabel(sale?: SaleApiRecord) {
  return sale?.items?.length ? sale.items.map((item) => item.description).join(', ') : 'Artikull'
}

function saleItemsQuantity(sale: SaleApiRecord) {
  return sale.items?.reduce((total, item) => total + Number(item.quantity ?? 1), 0) ?? 1
}

function saleCost(sale: SaleApiRecord) {
  if (sale.items?.length) {
    return sale.items.reduce((total, item) => total + Number(item.unit_cost) * Number(item.quantity ?? 1), 0)
  }

  return Math.max(Number(sale.total) - Number(sale.profit), 0)
}

function saleMargin(sale: SaleApiRecord) {
  const total = Number(sale.total)

  return total > 0 ? (Number(sale.profit) / total) * 100 : 0
}

function buildSalesReport(sales: SaleApiRecord[]) {
  const total = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
  const profit = sales.reduce((sum, sale) => sum + Number(sale.profit), 0)
  const discount = sales.reduce((sum, sale) => sum + Number(sale.discount ?? 0), 0)
  const cost = sales.reduce((sum, sale) => sum + saleCost(sale), 0)
  const itemsSold = sales.reduce((sum, sale) => sum + saleItemsQuantity(sale), 0)

  return {
    averageSale: sales.length ? total / sales.length : 0,
    cost,
    count: sales.length,
    dailyRows: salesByDay(sales),
    discount,
    itemsSold,
    margin: total > 0 ? (profit / total) * 100 : 0,
    paymentRows: salesByPayment(sales),
    productRows: salesByProduct(sales),
    profit,
    rows: reportRows(sales),
    total,
  }
}

function salesByPayment(sales: SaleApiRecord[]) {
  const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0)
  const grouped = new Map<string, { count: number; total: number }>()

  sales.forEach((sale) => {
    const label = paymentLabel(sale.payment_method)
    const current = grouped.get(label) ?? { count: 0, total: 0 }
    grouped.set(label, { count: current.count + 1, total: current.total + Number(sale.total) })
  })

  return Array.from(grouped.entries())
    .map(([label, value]) => ({ ...value, label, share: totalSales > 0 ? Math.round((value.total / totalSales) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
}

function salesByDay(sales: SaleApiRecord[]) {
  const grouped = new Map<string, { count: number; profit: number; total: number }>()

  sales.forEach((sale) => {
    const date = new Date(sale.created_at).toLocaleDateString('sq-AL')
    const current = grouped.get(date) ?? { count: 0, profit: 0, total: 0 }
    grouped.set(date, { count: current.count + 1, profit: current.profit + Number(sale.profit), total: current.total + Number(sale.total) })
  })

  return Array.from(grouped.entries()).map(([date, value]) => ({ ...value, date }))
}

function salesByProduct(sales: SaleApiRecord[]) {
  const grouped = new Map<string, { profit: number; quantity: number; total: number }>()

  sales.forEach((sale) => {
    const items = sale.items?.length ? sale.items : [{ description: saleItemsLabel(sale), profit: sale.profit, quantity: 1, unit_price: sale.total, unit_cost: String(saleCost(sale)) }]

    items.forEach((item) => {
      const quantity = Number(item.quantity ?? 1)
      const current = grouped.get(item.description) ?? { profit: 0, quantity: 0, total: 0 }
      grouped.set(item.description, {
        profit: current.profit + Number(item.profit),
        quantity: current.quantity + quantity,
        total: current.total + Number(item.unit_price) * quantity,
      })
    })
  })

  return Array.from(grouped.entries())
    .map(([description, value]) => ({ ...value, description }))
    .sort((a, b) => b.total - a.total)
}

function salesReportHtml(title: string, periodText: string, report: ReturnType<typeof buildSalesReport>) {
  const headers = ['#', 'Data', 'Fatura', 'Artikulli', 'Pagesa', 'Kosto', 'Totali', 'Fitimi', 'Marzha']
  const generatedAt = new Date().toLocaleString('sq-AL')

  return `<!doctype html>
<html lang="sq">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>
      body { color: #0f172a; font-family: Arial, Helvetica, sans-serif; margin: 28px; }
      h1 { font-size: 24px; margin: 0 0 6px; }
      h2 { font-size: 16px; margin: 24px 0 10px; }
      p { margin: 0; color: #475569; }
      .muted { color: #64748b; font-size: 12px; }
      .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
      .card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; }
      .card span { color: #64748b; display: block; font-size: 11px; margin-bottom: 6px; text-transform: uppercase; }
      .card strong { font-size: 18px; }
      table { border-collapse: collapse; width: 100%; font-size: 11px; }
      th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; color: #475569; font-size: 10px; text-transform: uppercase; }
      .right { text-align: right; }
      .green { color: #047857; font-weight: 700; }
      @media print { body { margin: 16px; } .summary { grid-template-columns: repeat(4, 1fr); } }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(periodText)}</p>
      <p class="muted">Gjeneruar më ${escapeHtml(generatedAt)} · Stoku</p>
    </div>
    <div class="summary">
      <div class="card"><span>Shitje</span><strong>${report.count}</strong></div>
      <div class="card"><span>Qarkullimi</span><strong>${escapeHtml(formatEuro(report.total))}</strong></div>
      <div class="card"><span>Fitimi</span><strong>${escapeHtml(formatEuro(report.profit))}</strong></div>
      <div class="card"><span>Marzha</span><strong>${escapeHtml(formatPercent(report.margin))}</strong></div>
      <div class="card"><span>Kosto</span><strong>${escapeHtml(formatEuro(report.cost))}</strong></div>
      <div class="card"><span>Mesatarja / faturë</span><strong>${escapeHtml(formatEuro(report.averageSale))}</strong></div>
      <div class="card"><span>Artikuj</span><strong>${report.itemsSold}</strong></div>
      <div class="card"><span>Zbritje</span><strong>${escapeHtml(formatEuro(report.discount))}</strong></div>
    </div>
    <h2>Pagesat</h2>
    <table><thead><tr><th>Metoda</th><th class="right">Fatura</th><th class="right">Totali</th><th class="right">Pjesëmarrja</th></tr></thead><tbody>
      ${report.paymentRows.map((row) => `<tr><td>${escapeHtml(row.label)}</td><td class="right">${row.count}</td><td class="right">${escapeHtml(formatEuro(row.total))}</td><td class="right">${escapeHtml(formatPercent(row.share))}</td></tr>`).join('') || '<tr><td colspan="4">Nuk ka të dhëna.</td></tr>'}
    </tbody></table>
    <h2>Produktet kryesore</h2>
    <table><thead><tr><th>Produkti</th><th class="right">Sasia</th><th class="right">Totali</th><th class="right">Fitimi</th></tr></thead><tbody>
      ${report.productRows.map((row) => `<tr><td>${escapeHtml(row.description)}</td><td class="right">${row.quantity}</td><td class="right">${escapeHtml(formatEuro(row.total))}</td><td class="right green">${escapeHtml(formatEuro(row.profit))}</td></tr>`).join('') || '<tr><td colspan="4">Nuk ka të dhëna.</td></tr>'}
    </tbody></table>
    <h2>Detajet e shitjeve</h2>
    <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>
      ${report.rows.map((row, index) => `<tr><td>${index + 1}</td>${row.map((cell, cellIndex) => `<td class="${cellIndex >= 4 ? 'right' : ''}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="9">Nuk ka shitje për këtë periudhë.</td></tr>'}
    </tbody></table>
  </body>
</html>`
}

function downloadUtf8Blob(content: string, filename: string, type: string) {
  const blob = new Blob([`\uFEFF${content}`], { type })
  downloadBlob(blob, filename)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('de-DE', { currency: 'EUR', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat('sq-AL', { maximumFractionDigits: 1 }).format(value)}%`
}

function todayInputValue() {
  return dateInputValue(new Date())
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function reportRangeForPeriod(period: ReportPeriod, range: { from: string; to: string }) {
  if (period === 'custom') return range

  const now = new Date()

  if (period === 'weekly') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)

    return { from: dateInputValue(start), to: dateInputValue(now) }
  }

  if (period === 'monthly') {
    return {
      from: dateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: dateInputValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }

  const today = dateInputValue(now)

  return { from: today, to: today }
}

function formatDateLabel(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('sq-AL') : '-'
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
