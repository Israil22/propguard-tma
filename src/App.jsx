import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'

function App() {
  const [tgUser, setTgUser] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [connectMethod, setConnectMethod] = useState('credentials')

  // Поля формы
  const [firmName, setFirmName] = useState('FTMO')
  const [initialBalance, setInitialBalance] = useState('100000')
  const [maxDailyLoss, setMaxDailyLoss] = useState('5000')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [server, setServer] = useState('')
  const [platform, setPlatform] = useState('cTrader')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp
      tg.ready()
      tg.expand()
      if (tg.initDataUnsafe?.user) {
        setTgUser(tg.initDataUnsafe.user)
      }
    }
    fetchAccounts()
  }, [])

  // Загружаем ВСЕ подключенные счета из Supabase
  async function fetchAccounts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('prop_accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки:', error.message)
    } else if (data) {
      setAccounts(data)
    }
    setLoading(false)
  }

  // Сохраняем новый счет и добавляем его в общий список
  async function handleSaveAccount(e) {
    e.preventDefault()
    setSaving(true)

    const accountNum = connectMethod === 'credentials'
      ? (login.trim() || `${firmName}-MT5`)
      : `${platform}-${apiKey.slice(0, 6) || 'API'}`

    const { data, error } = await supabase
      .from('prop_accounts')
      .insert([
        {
          user_id: crypto.randomUUID(),
          account_number: accountNum,
          firm_name: firmName,
          initial_balance: Number(initialBalance) || 100000,
          max_daily_loss: Number(maxDailyLoss) || 5000,
          current_daily_pnl: 0
        }
      ])
      .select()

    setSaving(false)

    if (error) {
      alert('Ошибка сохранения: ' + error.message)
    } else if (data && data.length > 0) {
      setAccounts((prev) => [data[0], ...prev])
      setShowConnect(false)
      setLogin('')
      setPassword('')
      setApiKey('')
    }
  }

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-orange-500">PropGuard</h1>
        <div className="text-right">
          <p className="text-xs text-gray-400">Трейдер</p>
          <p className="text-sm font-semibold text-cyan-400">
            {tgUser ? tgUser.first_name : 'Веб-версия'}
          </p>
        </div>
      </div>

      {!showConnect ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Активные счета ({accounts.length})
            </h2>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 my-10">Загрузка данных из базы...</p>
          ) : accounts.length > 0 ? (
            <div className="space-y-4 mb-6">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-gray-800 p-4 rounded-xl border border-gray-700"
                >
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                    <span className="text-base font-bold text-cyan-400">
                      {acc.firm_name} • {acc.account_number}
                    </span>
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                      Активен
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Баланс</p>
                      <p className="text-sm font-bold text-white">
                        ${Number(acc.initial_balance).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Дневной PnL</p>
                      <p className={`text-sm font-bold ${Number(acc.current_daily_pnl) < 0 ? 'text-red-500' : 'text-green-400'}`}>
                        ${Number(acc.current_daily_pnl).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Лимит/день</p>
                      <p className="text-sm font-bold text-orange-400">
                        -${Number(acc.max_daily_loss).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center mb-6">
              <p className="text-gray-400 text-sm">Нет подключенных счетов</p>
            </div>
          )}

          <button
            onClick={() => setShowConnect(true)}
            className="w-full bg-cyan-600 active:bg-cyan-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-cyan-600/20"
          >
            + Подключить торговый счет
          </button>
        </>
      ) : (
        <form onSubmit={handleSaveAccount} className="bg-gray-800 p-5 rounded-xl border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Подключение счета</h2>
            <button type="button" onClick={() => setShowConnect(false)} className="text-gray-400 text-xl">&times;</button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Проп-фирма</label>
              <select
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
              >
                <option value="FTMO">FTMO</option>
                <option value="Apex">Apex Trader Funding</option>
                <option value="FundedNext">FundedNext</option>
                <option value="Topstep">Topstep</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Баланс ($)</label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Макс. просадка/день ($)</label>
              <input
                type="number"
                value={maxDailyLoss}
                onChange={(e) => setMaxDailyLoss(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex bg-gray-900 rounded-lg p-1 mb-4">
            <button
              type="button"
              onClick={() => setConnectMethod('credentials')}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${connectMethod === 'credentials' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400'}`}
            >
              Логин / Пароль
            </button>
            <button
              type="button"
              onClick={() => setConnectMethod('api')}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${connectMethod === 'api' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400'}`}
            >
              API Ключ
            </button>
          </div>

          {connectMethod === 'credentials' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Номер счета (Login)</label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Например: 1002345"
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Инвесторский пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Только для чтения"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Сервер брокера</label>
                <input
                  type="text"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  placeholder="Например: FTMO-Server"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Платформа</label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
                >
                  <option value="cTrader">cTrader</option>
                  <option value="DXtrade">DXtrade</option>
                  <option value="TradeLocker">TradeLocker</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Введите ключ"
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-6 bg-orange-500 active:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить и Подключить'}
          </button>
        </form>
      )}
    </div>
  )
}

export default App