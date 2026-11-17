import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [tgUser, setTgUser] = useState(null)

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
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Баланс</p>
          <p className="text-xl font-bold text-white">$100,000</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Просадка (Daily)</p>
          <p className="text-xl font-bold text-red-500">-$450</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 col-span-2">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Цель (Profit Target)</p>
          <p className="text-2xl font-bold text-green-400">$8,000</p>
        </div>
      </div>
      
      <button className="w-full bg-orange-500 active:bg-orange-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-orange-500/20">
        + Добавить сделку
      </button>
    </div>
  )
}

export default App