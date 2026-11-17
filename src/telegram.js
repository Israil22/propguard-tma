export const TELEGRAM_CONFIG = {
  BOT_TOKEN: "9268300724:AAG4AbNzelx4C75-SFJpTnLxfp_bzP5w_4Y", // Твой текущий токен
  CHAT_ID: "6203658501",
  SUPPORT_USERNAME: "Xuxvim" // Замени на свой юзернейм в Telegram (без @), чтобы кнопка вела на тебя
}

// Отправка обычного алерта о просадке/стопе
export async function sendTelegramAlert(firm, account, pnl, isHardStopped) {
  const message = isHardStopped 
    ? `🚨 ВНИМАНИЕ! ТОРГОВЛЯ ЗАБЛОКИРОВАНА!\nПроп-счет: ${firm} #${account}\nПревышен дневной лимит потерь. Текущий PnL: $${pnl}`
    : `⚠️ Предупреждение по риску!\nПроп-счет: ${firm} #${account}\nСчет ушел в просадку. Текущий PnL: $${pnl}`

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CONFIG.CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💬 Поддержка", url: `https://t.me/${TELEGRAM_CONFIG.SUPPORT_USERNAME}` },
              { text: "🔕 Отключить алерты", callback_data: "toggle_alerts_off" }
            ]
          ]
        }
      })
    })
  } catch (err) {
    console.error("Ошибка сети при отправке в Telegram:", err)
  }
}

// Приветственное сообщение при первом запуске / настройке
export async function sendWelcomeMessage() {
  const message = `🤖 **Добро пожаловать в PropGuard Bot!**\n\nТерминал риск-менеджмента успешно подключен к вашему аккаунту.\n\n• Вы будете получать уведомления при уходе счета в просадку или срабатывании стопа.\n• Используйте кнопку ниже для связи с поддержкой в случае вопросов.`

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CONFIG.CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: "💬 Связаться с поддержкой", url: `https://t.me/${TELEGRAM_CONFIG.SUPPORT_USERNAME}` }
            ]
          ]
        }
      })
    })
  } catch (err) {
    console.error("Ошибка отправки приветствия:", err)
  }
}