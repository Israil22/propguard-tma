import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import NewsCalendar from './NewsCalendar'

// Локальная дата устройства в формате YYYY-MM-DD
function getLocalDateString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Обратный отсчет до 00:00 по местному времени
function getTimeUntilMidnight() {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
  const diff = Math.max(0, midnight - now)
  const h = String(Math.floor(diff / 3600000)).padStart(2, '0')
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function App() {
  const [tgUser, setTgUser] = useState(null)
  const [webUser, setWebUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Таймер до полуночи
  const [timeToReset, setTimeToReset] = useState(getTimeUntilMidnight())
  const currentDateRef = useRef(getLocalDateString())

  // Авторизация
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authSubmitting, setAuthSubmitting] = useState(false)

  // Счета и сделки
  const [accounts, setAccounts] = useState([])
  const [tradesByAccount, setTradesByAccount] = useState({})
  const [expandedAccountId, setExpandedAccountId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showConnect, setShowConnect] = useState(false)
  const [connectMethod, setConnectMethod] = useState('credentials')
  const [activeTab, setActiveTab] = useState('accounts')

  // Форма добавления сделки
  const [tradeModalAccount, setTradeModalAccount] = useState(null)
  const [tradeSymbol, setTradeSymbol] = useState('XAUUSD')
  const [tradeDirection, setTradeDirection] = useState('LONG')
  const [tradePnl, setTradePnl] = useState('')
  const [tradeNote, setTradeNote] = useState('')
  const [savingTrade, setSavingTrade] = useState(false)

  // Форма подключения счета
  const [firmName, setFirmName] = useState('FTMO')
  const [customFirmName, setCustomFirmName] = useState('')
  const [initialBalance, setInitialBalance] = useState('100000')
  const [maxDailyLoss, setMaxDailyLoss] = useState('5000')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [server, setServer] = useState('')
  const [platform, setPlatform] = useState('cTrader')
  const [apiKey, setApiKey] = useState('')

  const currentUserId = tgUser ? `tg_${tgUser.id}` : webUser ? webUser.id : null

  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.user) {
      tg.ready()
      tg.expand()
      setTgUser(tg.initDataUnsafe.user)
      setAuthLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setWebUser(session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setWebUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Секундный таймер + автосброс при наступлении 00:00
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeToReset(getTimeUntilMidnight())
      const today = getLocalDateString()
      if (today !== currentDateRef.current) {
        currentDateRef.current = today
        if (currentUserId) {
          fetchAccounts(currentUserId)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [currentUserId])

  useEffect(() => {
    if (currentUserId) {
      fetchAccounts(currentUserId)
    } else {
      setAccounts([])
      setTradesByAccount({})
    }
  }, [currentUserId])

  async function fetchAccounts(uid) {
    setLoading(true)
    const { data, error } = await supabase
      .from('prop_accounts')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки счетов:', error.message)
      setLoading(false)
      return
    }

    if (data) {
      const today = getLocalDateString()
      const accountsToReset = data.filter((acc) => acc.last_reset_date !== today)

      // Сбрасываем дневной PnL и блокировку для счетов, у которых наступил новый день
      if (accountsToReset.length > 0) {
        const idsToReset = accountsToReset.map((a) => a.id)
        await supabase
          .from('prop_accounts')
          .update({
            current_daily_pnl: 0,
            is_locked: false,
            last_reset_date: today
          })
          .in('id', idsToReset)
      }

      const normalizedAccounts = data.map((acc) =>
        acc.last_reset_date !== today
          ? { ...acc, current_daily_pnl: 0, is_locked: false, last_reset_date: today }
          : acc
      )

      setAccounts(normalizedAccounts)
      if (normalizedAccounts.length > 0) {
        fetchTrades(normalizedAccounts.map((a) => a.id))
      }
    }
    setLoading(false)
  }

  async function fetchTrades(accountIds) {
    const { data, error } = await supabase
      .from('trade_logs')
      .select('*')
      .in('account_id', accountIds)
      .order('created_at', { ascending: false })

    if (!error && data) {
      const grouped = {}
      data.forEach((t) => {
        if (!grouped[t.account_id]) grouped[t.account_id] = []
        grouped[t.account_id].push(t)
      })
      setTradesByAccount(grouped)
    }
  }

  async function handleAuth(e) {
    e.preventDefault()
    setAuthError('')
    setAuthSubmitting(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password: authPassword })
      if (error) setAuthError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: authPassword })
      if (error) setAuthError('Неверный email или пароль')
    }
    setAuthSubmitting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setAccounts([])
    setTradesByAccount({})
  }

  async function handleSaveAccount(e) {
    e.preventDefault()
    if (!currentUserId) return
    setSaving(true)

    const finalFirmName = firmName === 'custom'
      ? (customFirmName.trim() || 'Другая фирма')
      : firmName

    const accountNum = connectMethod === 'credentials'
      ? (login.trim() || `${finalFirmName}-MT5`)
      : `${platform}-${apiKey.slice(0, 6) || 'API'}`

    const { data, error } = await supabase
      .from('prop_accounts')
      .insert([
        {
          user_id: currentUserId,
          account_number: accountNum,
          firm_name: finalFirmName,
          initial_balance: Number(initialBalance) || 100000,
          max_daily_loss: Number(maxDailyLoss) || 5000,
          current_daily_pnl: 0,
          is_locked: false,
          last_reset_date: getLocalDateString()
        }
      ])
      .select()

    setSaving(false)

    if (error) {
      alert('Ошибка сохранения: ' + error.message)
    } else if (data && data.length > 0) {
      setAccounts((prev) => [data[0], ...prev])
      setShowConnect(false)
      setCustomFirmName('')
      setLogin('')
      setPassword('')
      setApiKey('')
    }
  }

  async function handleSaveTrade(e) {
    e.preventDefault()
    if (!tradeModalAccount) return
    setSavingTrade(true)

    const pnlValue = Number(tradePnl) || 0

    const { data: newTrade, error: tradeError } = await supabase
      .from('trade_logs')
      .insert([
        {
          account_id: tradeModalAccount.id,
          symbol: tradeSymbol.trim().toUpperCase() || 'XAUUSD',
          direction: tradeDirection,
          pnl: pnlValue,
          note: tradeNote.trim()
        }
      ])
      .select()

    if (tradeError) {
      alert('Ошибка сохранения сделки: ' + tradeError.message)
      setSavingTrade(false)
      return
    }

    const updatedDailyPnl = Number(tradeModalAccount.current_daily_pnl || 0) + pnlValue
    const maxLoss = Number(tradeModalAccount.max_daily_loss || 0)
    const shouldLock = updatedDailyPnl <= -maxLoss && maxLoss > 0

    const { error: accError } = await supabase
      .from('prop_accounts')
      .update({
        current_daily_pnl: updatedDailyPnl,
        is_locked: shouldLock,
        last_reset_date: getLocalDateString()
      })
      .eq('id', tradeModalAccount.id)

    if (!accError) {
      setAccounts((prev) =>
        prev.map((acc) =>
          acc.id === tradeModalAccount.id
            ? { ...acc, current_daily_pnl: updatedDailyPnl, is_locked: shouldLock }
            : acc
        )
      )
      if (newTrade && newTrade.length > 0) {
        setTradesByAccount((prev) => ({
          ...prev,
          [tradeModalAccount.id]: [newTrade[0], ...(prev[tradeModalAccount.id] || [])]
        }))
      }
      setExpandedAccountId(tradeModalAccount.id)
      setTradeModalAccount(null)
      setTradePnl('')
      setTradeNote('')
    }

    setSavingTrade(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center font-sans">
        <p className="text-gray-400">Загрузка PropGuard...</p>
      </div>
    )
  }

  if (!currentUserId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <h1 className="text-3xl font-bold text-orange-500 text-center mb-2">PropGuard</h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            {isSignUp ? 'Создайте аккаунт трейдера' : 'Войдите в свой дашборд'}
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@example.com"
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Пароль</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                minLength={6}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white text-sm outline-none focus:border-cyan-500"
              />
            </div>

            {authError && (
              <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/30 p-2 rounded-lg">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {authSubmitting ? 'Подождите...' : isSignUp ? 'Зарегистрироваться' : 'Войти'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setAuthError('')
              }}
              className="text-sm text-cyan-400 hover:underline"
            >
              {isSignUp ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-orange-500">PropGuard</h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-400">Трейдер</p>
            <p className="text-sm font-semibold text-cyan-400">
              {tgUser ? tgUser.first_name : webUser?.email?.split('@')[0]}
            </p>
          </div>
          {!tgUser && (
            <button
              onClick={handleLogout}
              className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-300"
            >
              Выйти
            </button>
          )}
        </div>
      </div>

      {/* Переключатель вкладок */}
      <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 mb-5">
        <button
          onClick={() => {
            setActiveTab('accounts')
            setShowConnect(false)
          }}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'accounts'
              ? 'bg-cyan-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Счета
        </button>
        <button
          onClick={() => {
            setActiveTab('news')
            setShowConnect(false)
          }}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
            activeTab === 'news'
              ? 'bg-cyan-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Новости
        </button>
      </div>

      {activeTab === 'news' ? (
        <NewsCalendar />
      ) : !showConnect ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Мои активные счета ({accounts.length})
            </h2>
            <span className="text-xs text-gray-500">
              Сброс дня через {timeToReset}
            </span>
          </div>

          {loading ? (
            <p className="text-center text-gray-400 my-10">Загрузка ваших счетов...</p>
          ) : accounts.length > 0 ? (
            <div className="space-y-4 mb-6">
              {accounts.map((acc) => {
                const dailyPnl = Number(acc.current_daily_pnl || 0)
                const maxLoss = Number(acc.max_daily_loss || 1)
                const usedLoss = dailyPnl < 0 ? Math.abs(dailyPnl) : 0
                const drawdownPercent = Math.min(100, Math.round((usedLoss / maxLoss) * 100))
                const isHardStopped = acc.is_locked || drawdownPercent >= 100
                const isWarning = drawdownPercent >= 80 && !isHardStopped
                const accTrades = tradesByAccount[acc.id] || []

                return (
                  <div
                    key={acc.id}
                    className={`bg-gray-800 p-4 rounded-xl border ${
                      isHardStopped
                        ? 'border-red-500 shadow-lg shadow-red-500/10'
                        : isWarning
                        ? 'border-yellow-500'
                        : 'border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-700">
                      <span className="text-base font-bold text-cyan-400">
                        {acc.firm_name} • {acc.account_number}
                      </span>
                      {isHardStopped ? (
                        <span className="text-xs bg-red-500/20 text-red-400 font-bold px-2 py-0.5 rounded-full">
                          ЗАБЛОКИРОВАН
                        </span>
                      ) : isWarning ? (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 font-bold px-2 py-0.5 rounded-full">
                          РИСК {drawdownPercent}%
                        </span>
                      ) : (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          Активен
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Баланс</p>
                        <p className="text-sm font-bold text-white">
                          ${Number(acc.initial_balance).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Дневной PnL</p>
                        <p className={`text-sm font-bold ${dailyPnl < 0 ? 'text-red-500' : 'text-green-400'}`}>
                          {dailyPnl > 0 ? '+' : ''}${dailyPnl.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Лимит/день</p>
                        <p className="text-sm font-bold text-orange-400">
                          -${maxLoss.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Шкала дневной просадки */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                        <span>Использовано дневного лимита</span>
                        <span className={isHardStopped ? 'text-red-400 font-bold' : ''}>
                          {drawdownPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isHardStopped
                              ? 'bg-red-500'
                              : isWarning
                              ? 'bg-yellow-500'
                              : 'bg-cyan-500'
                          }`}
                          style={{ width: `${drawdownPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Предупреждение о блокировке до 00:00 */}
                    {isHardStopped && (
                      <div className="mb-3 bg-red-500/10 border border-red-500/40 rounded-lg p-2.5 text-center">
                        <p className="text-xs font-bold text-red-400">
                          Дневной лимит пробит — торговля остановлена
                        </p>
                        <p className="text-[11px] text-gray-300 mt-0.5">
                          Разблокировка в 00:00 (через <span className="font-mono font-bold text-white">{timeToReset}</span>)
                        </p>
                      </div>
                    )}

                    {/* Кнопки действий по счету */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setTradeModalAccount(acc)}
                        disabled={isHardStopped}
                        className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-colors ${
                          isHardStopped
                            ? 'bg-gray-900 text-gray-600 border border-gray-800 cursor-not-allowed'
                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                      >
                        {isHardStopped ? 'Торговля запрещена' : '+ Сделка'}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedAccountId(expandedAccountId === acc.id ? null : acc.id)
                        }
                        className="flex-1 bg-gray-900 hover:bg-gray-700 border border-gray-700 text-gray-300 text-xs font-semibold py-2 rounded-lg transition-colors"
                      >
                        История ({accTrades.length})
                      </button>
                    </div>

                    {/* Раскрывающийся список сделок */}
                    {expandedAccountId === acc.id && (
                      <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                        {accTrades.length === 0 ? (
                          <p className="text-xs text-gray-500 text-center py-2">
                            Сделок пока нет
                          </p>
                        ) : (
                          accTrades.map((t) => (
                            <div
                              key={t.id}
                              className="flex justify-between items-center bg-gray-900/70 p-2.5 rounded-lg text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-white">{t.symbol}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      t.direction === 'LONG'
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-red-500/20 text-red-400'
                                    }`}
                                  >
                                    {t.direction}
                                  </span>
                                </div>
                                {t.note && (
                                  <p className="text-gray-400 text-[11px] mt-0.5">{t.note}</p>
                                )}
                              </div>
                              <span
                                className={`font-bold text-sm ${
                                  Number(t.pnl) < 0 ? 'text-red-400' : 'text-green-400'
                                }`}
                              >
                                {Number(t.pnl) > 0 ? '+' : ''}${Number(t.pnl).toLocaleString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 text-center mb-6">
              <p className="text-gray-400 text-sm">У вас пока нет подключенных счетов</p>
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
                <option value="custom">+ Другая (ввести вручную)</option>
              </select>

              {firmName === 'custom' && (
                <input
                  type="text"
                  value={customFirmName}
                  onChange={(e) => setCustomFirmName(e.target.value)}
                  placeholder="Название фирмы (например: The5ers, Upsckeyl)"
                  required
                  className="w-full mt-2 bg-gray-900 border border-cyan-500 rounded-lg p-2 text-white text-sm outline-none"
                />
              )}
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

      {/* Модальное окно добавления сделки */}
      {tradeModalAccount && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleSaveTrade}
            className="w-full max-w-sm bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-white">
                Новая сделка • {tradeModalAccount.firm_name}
              </h3>
              <button
                type="button"
                onClick={() => setTradeModalAccount(null)}
                className="text-gray-400 text-xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Инструмент</label>
                <input
                  type="text"
                  value={tradeSymbol}
                  onChange={(e) => setTradeSymbol(e.target.value)}
                  placeholder="XAUUSD, NAS100, BTCUSDT"
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTradeDirection('LONG')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                    tradeDirection === 'LONG'
                      ? 'bg-green-500/20 border-green-500 text-green-400'
                      : 'bg-gray-900 border-gray-700 text-gray-400'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setTradeDirection('SHORT')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold border ${
                    tradeDirection === 'SHORT'
                      ? 'bg-red-500/20 border-red-500 text-red-400'
                      : 'bg-gray-900 border-gray-700 text-gray-400'
                  }`}
                >
                  SHORT
                </button>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Результат PnL ($) — с минусом если убыток
                </label>
                <input
                  type="number"
                  step="any"
                  value={tradePnl}
                  onChange={(e) => setTradePnl(e.target.value)}
                  placeholder="Например: -250 или 450"
                  required
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Заметка / Сетап (необязательно)</label>
                <input
                  type="text"
                  value={tradeNote}
                  onChange={(e) => setTradeNote(e.target.value)}
                  placeholder="Например: FVG 15m, вход по тренду"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingTrade}
              className="w-full mt-5 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-2.5 rounded-xl transition-colors"
            >
              {savingTrade ? 'Сохранение...' : 'Записать сделку'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App