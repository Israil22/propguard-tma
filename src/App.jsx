import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [tgUser, setTgUser] = useState(null)
  const [showConnect, setShowConnect] = useState(false)
  const [connectMethod, setConnectMethod] = useState('credentials') // 'credentials' или 'api'

  useEffect(() => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
      setTgUser(tg.initDataUnsafe.user);
    }
  }, [])

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-white font-sans">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-orange-500">PropGuard</h1>
        <div className="text-right">
          <p className="text-xs text-gray-400">Трейдер</p>
          <p className="text-sm font-semibold text-cyan-400">
            {tgUser ? tgUser.first_name : 'Загрузка...'}
          </p>
        </div>
      </div>
      
      {!showConnect ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Баланс</p>
              <p className="text-xl font-bold text-white">—</p>
            </div>
            <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Просадка</p>
              <p className="text-xl font-bold text-gray-500">—</p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowConnect(true)}
            className="w-full bg-cyan-600 active:bg-cyan-700 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-cyan-600/20"
          >
            Подключить торговый счет
          </button>
        </>
      ) : (
        <div className="bg-gray-800 p-5 rounded-xl border border-gray-700 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Подключение счета</h2>
            <button onClick={() => setShowConnect(false)} className="text-gray-400 text-xl">&times;</button>
          </div>

          {/* Переключатель методов */}
          <div className="flex bg-gray-900 rounded-lg p-1 mb-5">
            <button 
              onClick={() => setConnectMethod('credentials')}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${connectMethod === 'credentials' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400'}`}
            >
              Логин / Пароль
            </button>
            <button 
              onClick={() => setConnectMethod('api')}
              className={`flex-1 py-2 text-sm rounded-md transition-colors ${connectMethod === 'api' ? 'bg-gray-700 text-white font-bold' : 'text-gray-400'}`}
            >
              API Ключ
            </button>
          </div>

          {/* Форма Логин/Пароль */}
          {connectMethod === 'credentials' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Терминал (MT4/MT5)</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500">
                  <option>MetaTrader 5</option>
                  <option>MetaTrader 4</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Номер счета (Login)</label>
                <input type="text" placeholder="Например: 1002345" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Инвесторский пароль</label>
                <input type="password" placeholder="Только для чтения" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Сервер брокера</label>
                <input type="text" placeholder="Например: FTMO-Server" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
            </div>
          )}

          {/* Форма API */}
          {connectMethod === 'api' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Платформа</label>
                <select className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500">
                  <option>cTrader</option>
                  <option>DXtrade</option>
                  <option>TradeLocker</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <input type="text" placeholder="Введите ключ" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Secret (опционально)</label>
                <input type="password" placeholder="Секретный ключ" className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white text-sm outline-none focus:border-cyan-500" />
              </div>
            </div>
          )}

          <button className="w-full mt-6 bg-orange-500 active:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors">
            Сохранить и Подключить
          </button>
        </div>
      )}
    </div>
  )
}

export default App