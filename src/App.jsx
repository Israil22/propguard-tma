import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { sendTelegramAlert, sendWelcomeMessage } from './telegram'

function App() {
  const [accounts, setAccounts] = useState([])
  const [activeAccount, setActiveAccount] = useState(null)
  const [trades, setTrades] = useState([])

  const [symbol, setSymbol] = useState('EURUSD')
  const [direction, setDirection] = useState('BUY')
  const [setup, setSetup] = useState('FVG_Retest')
  const [pnlInput, setPnlInput] = useState('')

  const [showNewAccModal, setShowNewAccModal] = useState(false)
  const [firmName, setFirmName] = useState('FTMO')
  const [accNumber, setAccNumber] = useState('')
  const [initBalance, setInitBalance] = useState('100000')
  const [maxLoss, setMaxLoss] = useState('5000')
useEffect(() => {
    loadAccounts()
    sendWelcomeMessage() // Добавляем сюда для отправки приветствия
  }, [])

  async function loadAccounts() {
    const { data: accList } = await supabase
      .from('prop_accounts')
      .select('*')
      .order('created_at', { ascending: true })

    if (accList && accList.length > 0) {
      setAccounts(accList)
      const current = activeAccount 
        ? accList.find(a => a.id === activeAccount.id) || accList[0] 
        : accList[0]
      setActiveAccount(current)
      loadTrades(current.id)
    }
  }

  async function loadTrades(accountId) {
    const { data: tradeData } = await supabase
      .from('trade_logs')
      .select('*')
      .eq('account_id', accountId)
      .order('executed_at', { ascending: false })

    if (tradeData) setTrades(tradeData)
  }

  function handleSelectAccount(acc) {
    setActiveAccount(acc)
    loadTrades(acc.id)
  }

  async function handleCreateAccount(e) {
    e.preventDefault()
    if (!accNumber) return

    const { data } = await supabase
      .from('prop_accounts')
      .insert([{
        user_id: crypto.randomUUID(),
        account_number: accNumber,
        firm_name: firmName,
        initial_balance: parseFloat(initBalance),
        max_daily_loss: parseFloat(maxLoss),
        current_daily_pnl: 0
      }])
      .select()
      .single()

    if (data) {
      setAccNumber('')
      setShowNewAccModal(false)
      await loadAccounts()
      handleSelectAccount(data)
    }
  }

  async function handleAddTrade(e) {
    e.preventDefault()
    if (pnlInput === '' || activeAccount.is_hard_stopped) return

    const tradePnl = parseFloat(pnlInput)
    const newDailyPnl = Number(activeAccount.current_daily_pnl) + tradePnl
    const isBreached = newDailyPnl <= -Math.abs(activeAccount.max_daily_loss)

    const { error: tradeError } = await supabase.from('trade_logs').insert([{
      account_id: activeAccount.id,
      symbol: symbol.toUpperCase(),
      direction,
      pnl: tradePnl,
      setup_type: setup
    }])

    if (tradeError) {
      console.error("Ошибка сохранения сделки:", tradeError)
      alert("Не удалось сохранить сделку. Проверьте консоль.")
      return
    }
await supabase
      .from('prop_accounts')
      .update({
        current_daily_pnl: newDailyPnl,
        is_hard_stopped: isBreached
      })
      .eq('id', activeAccount.id)

    if (tradePnl < 0 || isBreached) {
      await sendTelegramAlert(activeAccount.firm_name, activeAccount.account_number, newDailyPnl, isBreached)
    }

    setPnlInput('')
    loadAccounts()
  }

  async function resetAccount() {
    if (!activeAccount) return
    await supabase.from('trade_logs').delete().eq('account_id', activeAccount.id)
    await supabase
      .from('prop_accounts')
      .update({ current_daily_pnl: 0, is_hard_stopped: false })
      .eq('id', activeAccount.id)
    loadAccounts()
  }

  if (!activeAccount) return <div className="min-h-screen bg-gray-900 text-white p-8">Загрузка данных...</div>

  const pnl = Number(activeAccount.current_daily_pnl)
  const balance = Number(activeAccount.initial_balance)
  const maxDailyLoss = Number(activeAccount.max_daily_loss)

  const currentLoss = pnl < 0 ? Math.abs(pnl) : 0
  const lossPercent = ((currentLoss / balance) * 100).toFixed(2)
  const maxLossPercent = ((maxDailyLoss / balance) * 100).toFixed(2)
  const lossBarWidth = Math.min((currentLoss / maxDailyLoss) * 100, 100)

  const profitTargetAmount = balance * 0.10
  const currentProfit = pnl > 0 ? pnl : 0
  const profitPercent = ((currentProfit / balance) * 100).toFixed(2)
  const targetPercent = (10).toFixed(2)
  const profitBarWidth = Math.min((currentProfit / profitTargetAmount) * 100, 100)

  const winningTrades = trades.filter(t => Number(t.pnl) > 0).length
  const winrate = trades.length > 0 ? Math.round((winningTrades / trades.length) * 100) : 0

  const setupTypes = ['FVG_Retest', 'Liquidity_Sweep', 'Order_Block']
  const setupStats = setupTypes.map(type => {
    const filtered = trades.filter(t => t.setup_type === type)
    const wins = filtered.filter(t => Number(t.pnl) > 0).length
    const totalPnl = filtered.reduce((sum, t) => sum + Number(t.pnl), 0)
    const wr = filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : 0
    return { type, count: filtered.length, wr, totalPnl }
  })

  const statusBadgeClass = activeAccount.is_hard_stopped
    ? 'bg-red-600 text-white animate-pulse'
    : pnl >= profitTargetAmount
    ? 'bg-blue-600 text-white'
    : 'bg-green-900 text-green-300'

  const lossTextColor = lossBarWidth >= 80 ? 'text-red-400' : lossBarWidth > 0 ? 'text-yellow-400' : 'text-gray-300'
  const lossBarColor = lossBarWidth >= 80 ? 'bg-red-500' : 'bg-yellow-500'

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">PropGuard</h1>
            <p className="text-gray-400 text-sm">Терминал риск-менеджмента и аналитики</p>
          </div>

          <div className="flex items-center space-x-2">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => handleSelectAccount(acc)}
                className={
                  acc.id === activeAccount.id
                    ? 'px-3 py-1.5 rounded text-sm font-medium border transition bg-blue-600 border-blue-500 text-white'
                    : 'px-3 py-1.5 rounded text-sm font-medium border transition bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                }
              >
                {acc.firm_name} #{acc.account_number}
              </button>
            ))}
            <button
              onClick={() => setShowNewAccModal(!showNewAccModal)}
              className="px-3 py-1.5 rounded text-sm font-bold bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700"
            >
              + Счет
            </button>
            <button onClick={resetAccount} className="text-xs bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-300 px-3 py-2 rounded border border-gray-700 ml-2">
              Сбросить день
            </button>
          </div>
        </div>

        {showNewAccModal && (
          <form onSubmit={handleCreateAccount} className="bg-gray-800 p-4 rounded-lg border border-blue-500/50 space-y-3">
            <h3 className="text-sm font-bold text-blue-400">Добавить новый проп-аккаунт</h3>
            <div className="grid grid-cols-4 gap-3">
              <input type="text" value={firmName} onChange={e => setFirmName(e.target.value)} placeholder="Проп (FTMO)" className="bg-gray-900 p-2 rounded text-sm border border-gray-700" />
              <input type="text" value={accNumber} onChange={e => setAccNumber(e.target.value)} placeholder="Номер счета" className="bg-gray-900 p-2 rounded text-sm border border-gray-700" />
              <input type="number" value={initBalance} onChange={e => setInitBalance(e.target.value)} placeholder="Депозит" className="bg-gray-900 p-2 rounded text-sm border border-gray-700" />
              <input type="number" value={maxLoss} onChange={e => setMaxLoss(e.target.value)} placeholder="Дневной лимит" className="bg-gray-900 p-2 rounded text-sm border border-gray-700" />
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowNewAccModal(false)} className="px-3 py-1 text-xs text-gray-400">Отмена</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold">Создать счет</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold">{activeAccount.firm_name} #{activeAccount.account_number}</h2>
                  <p className="text-xs text-gray-400">
                    Баланс: <span className="text-white font-semibold">${(balance + pnl).toLocaleString()}</span> (Старт: ${balance.toLocaleString()})
                  </p>
                </div>
                <span className={'px-3 py-1 rounded text-xs font-bold ' + statusBadgeClass}>
                  {activeAccount.is_hard_stopped ? 'БЛОКИРОВКА' : pnl >= profitTargetAmount ? 'ЦЕЛЬ ДОСТИГНУТА 🎉' : 'ЗАЩИТА АКТИВНА'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 bg-gray-900/60 p-4 rounded border border-gray-700/50">
                <div>
                  <p className="text-xs text-gray-400">Риск / Цель</p>
                  <div className="flex items-center space-x-2">
                    <span className={'text-base font-bold ' + lossTextColor}>-{lossPercent}%</span>
                    <span className="text-gray-500">/</span>
                    <span className="text-base font-bold text-green-400">+{profitPercent}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Winrate</p>
                  <p className="text-lg font-bold text-blue-400">{winrate}% <span className="text-xs text-gray-500 font-normal">({winningTrades}/{trades.length})</span></p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Чистый PnL</p>
                  <p className={'text-lg font-bold ' + (pnl < 0 ? 'text-red-400' : 'text-green-400')}>{pnl >= 0 ? '+$' + pnl : '-$' + Math.abs(pnl)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Прогресс челленджа (+${profitTargetAmount.toLocaleString()})</span>
                  <span className="text-green-400 font-semibold">{profitBarWidth.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-700">
                  <div className="h-2.5 bg-green-500 transition-all duration-500" style={{ width: profitBarWidth + '%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Дневной стоп (-${maxDailyLoss.toLocaleString()})</span>
                  <span className={lossBarWidth > 0 ? 'text-red-400 font-semibold' : 'text-gray-500'}>{lossBarWidth.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-900 rounded-full h-2.5 overflow-hidden border border-gray-700">
                  <div className={'h-2.5 transition-all duration-500 ' + lossBarColor} style={{ width: lossBarWidth + '%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
            <h3 className="text-base font-semibold mb-3">Аналитика сетапов</h3>
            <div className="space-y-3">
              {setupStats.map(s => (
                <div key={s.type} className="bg-gray-900/60 p-3 rounded border border-gray-700/50 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-200">{s.type}</p>
                    <p className="text-xs text-gray-400">Сделок: {s.count} | WR: <span className="text-blue-400 font-semibold">{s.wr}%</span></p>
                  </div>
                  <span className={'text-sm font-bold ' + (s.totalPnl >= 0 ? 'text-green-400' : 'text-red-400')}>{s.totalPnl >= 0 ? '+$' + s.totalPnl : '-$' + Math.abs(s.totalPnl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <form onSubmit={handleAddTrade} className="bg-gray-800 p-5 rounded-lg border border-gray-700 flex flex-wrap md:flex-nowrap items-center gap-3">
          <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="Актив" className="bg-gray-700 p-2.5 rounded text-sm text-white border border-gray-600 w-full md:w-1/5" />
          <select value={direction} onChange={e => setDirection(e.target.value)} className="bg-gray-700 p-2.5 rounded text-sm text-white border border-gray-600 w-full md:w-1/5">
            <option value="BUY">LONG (BUY)</option>
            <option value="SELL">SHORT (SELL)</option>
          </select>
          <select value={setup} onChange={e => setSetup(e.target.value)} className="bg-gray-700 p-2.5 rounded text-sm text-white border border-gray-600 w-full md:w-1/5">
            <option value="FVG_Retest">FVG Retest</option>
            <option value="Liquidity_Sweep">Liquidity Sweep</option>
            <option value="Order_Block">Order Block</option>
          </select>
          <input type="number" value={pnlInput} onChange={e => setPnlInput(e.target.value)} placeholder="Результат в $ (напр. -1500)" className="bg-gray-700 p-2.5 rounded text-sm text-white border border-gray-600 w-full md:w-1/5" />
          <button type="submit" disabled={activeAccount.is_hard_stopped} className={'w-full md:w-1/5 py-2.5 px-4 rounded text-sm font-bold transition ' + (activeAccount.is_hard_stopped ? 'bg-gray-600 cursor-not-allowed text-gray-300' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
            {activeAccount.is_hard_stopped ? 'БЛОКИРОВКА' : '+ Записать сделку'}
          </button>
        </form>

        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
          <h3 className="text-base font-semibold mb-4">История сделок ({trades.length})</h3>
          {trades.length === 0 ? (
            <p className="text-gray-500 text-sm">Журнал пуст. Запишите первую сделку.</p>
          ) : (
            <div className="space-y-2">
              {trades.map((t) => (
                <div key={t.id} className="flex justify-between items-center bg-gray-900/50 p-3 rounded border border-gray-700/50 text-sm">
                  <div className="flex items-center space-x-3">
                    <span className={'px-2 py-0.5 rounded text-xs font-bold ' + (t.direction === 'BUY' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300')}>{t.direction}</span>
                    <span className="font-bold text-white">{t.symbol}</span>
                    <span className="text-blue-300 text-xs bg-blue-950/60 px-2 py-0.5 rounded">{t.setup_type}</span>
                  </div>
                  <span className={'font-bold ' + (t.pnl >= 0 ? 'text-green-400' : 'text-red-400')}>{t.pnl >= 0 ? '+$' + t.pnl : '-$' + Math.abs(t.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default App