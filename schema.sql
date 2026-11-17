-- 1. Удаление старых таблиц (если нужно пересоздать с нуля)
DROP TABLE IF EXISTS trade_logs;
DROP TABLE IF EXISTS prop_accounts;

-- 2. Таблица торговых аккаунтов трейдеров
CREATE TABLE prop_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    firm_name VARCHAR(50) NOT NULL,
    initial_balance NUMERIC(12, 2) NOT NULL,
    max_daily_loss NUMERIC(12, 2) NOT NULL,
    current_daily_pnl NUMERIC(12, 2) DEFAULT 0.00,
    is_hard_stopped BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Таблица журнала сделок
CREATE TABLE trade_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES prop_accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(5) CHECK (direction IN ('BUY', 'SELL')),
    pnl NUMERIC(12, 2) NOT NULL,
    setup_type VARCHAR(50) DEFAULT 'FVG_Retest',
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Индекс для быстрого поиска сделок
CREATE INDEX idx_trade_account_date ON trade_logs(account_id, executed_at);

-- 5. Отключение RLS для упрощения работы (для разработки)
ALTER TABLE prop_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE trade_logs DISABLE ROW LEVEL SECURITY;

-- 6. Создание тестового аккаунта по умолчанию
INSERT INTO prop_accounts (id, user_id, account_number, firm_name, initial_balance, max_daily_loss, current_daily_pnl)
VALUES ('a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'FTMO-TEST-123', 'FTMO', 100000.00, 5000.00, 0.00);