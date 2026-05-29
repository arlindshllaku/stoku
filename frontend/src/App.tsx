import Chart from 'react-apexcharts'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleDollarSign,
  LayoutDashboard,
  PackagePlus,
  ReceiptText,
  Repeat2,
  Search,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import './index.css'

const metrics = [
  { label: 'Vlera e stokut', value: '€184,320', delta: '+8.4%', icon: Boxes },
  { label: 'Produkte në stok', value: '1,284', delta: '+43', icon: PackagePlus },
  { label: 'Shitjet sot', value: '€7,890', delta: '+12.1%', icon: ReceiptText },
  { label: 'Gjendja e arkës', value: '€22,640', delta: '-€420', icon: Banknote },
]

const transactions = [
  { type: 'Shitje normale', ref: 'iPhone 15 Pro 256GB', amount: '+€1,080', status: 'Shitur', tone: 'in' },
  { type: 'Ndërrim', ref: 'Galaxy S24 për iPhone 14', amount: '+€190', status: 'Pajisje e pranuar', tone: 'in' },
  { type: 'Shpenzim arke', ref: 'Stok xhamash mbrojtës', amount: '-€320', status: 'Shpenzim', tone: 'out' },
  { type: 'Depozitim manual', ref: 'Rregullim i gjendjes fillestare', amount: '+€500', status: 'Arkë', tone: 'in' },
]

const inventory = [
  { imei: '356789102345671', product: 'Apple iPhone 15 Pro', color: 'Natyrale', storage: '256GB', cost: '€860', price: '€1,080', status: 'Në stok' },
  { imei: '359901881237443', product: 'Samsung Galaxy S24', color: 'E zezë', storage: '128GB', cost: '€520', price: '€720', status: 'Rezervuar' },
  { imei: '867442109875331', product: 'Xiaomi 14', color: 'E bardhë', storage: '512GB', cost: '€490', price: '€650', status: 'Në stok' },
  { imei: 'Nuk ka', product: 'Karikues i shpejtë USB-C', color: 'I zi', storage: '-', cost: '€9', price: '€19', status: 'Në stok' },
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
          {[
            [LayoutDashboard, 'Paneli'],
            [Boxes, 'Inventari'],
            [ReceiptText, 'Shitjet'],
            [Repeat2, 'Ndërrimet'],
            [Banknote, 'Arka'],
            [Users, 'Përdoruesit'],
            [ShieldCheck, 'Historiku'],
          ].map(([Icon, label]) => (
            <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-100" key={label as string}>
              <Icon size={18} />
              <span>{label as string}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <h1 className="text-xl font-semibold">Dyqani Qendror</h1>
              <p className="text-sm text-slate-500">Pamje në kohë reale për inventarin, shitjet, arkën dhe historikun</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
                <input className="h-10 w-52 rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-600" placeholder="Kërko IMEI ose model" />
              </label>
              <button className="inline-flex h-10 items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700">
                <PackagePlus size={17} />
                Artikull i ri
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 lg:p-6">
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

          <section className="rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Pamje e inventarit</h2>
                <p className="text-sm text-slate-500">Stoku me vlerë të lartë dhe status për secilin dyqan</p>
              </div>
              <button className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50">Eksporto</button>
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
                  {inventory.map((item) => (
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
        </div>
      </section>
    </main>
  )
}

export default App
