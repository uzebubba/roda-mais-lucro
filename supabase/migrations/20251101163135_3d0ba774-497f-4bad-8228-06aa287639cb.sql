-- ============================================================================
-- FASE 2: Criar tabelas do sistema com RLS multi-tenant
-- ============================================================================

-- 1. TABELA DE ROLES SEPARADA (segurança crítica)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'driver',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role manages all roles" ON public.user_roles;
CREATE POLICY "Service role manages all roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Função security definer com tipo correto app_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2. TRANSAÇÕES FINANCEIRAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  date timestamptz NOT NULL,
  description text NOT NULL,
  category text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own transactions" ON public.transactions;
CREATE POLICY "Users view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own transactions" ON public.transactions;
CREATE POLICY "Users insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own transactions" ON public.transactions;
CREATE POLICY "Users update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own transactions" ON public.transactions;
CREATE POLICY "Users delete own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- 3. GASTOS FIXOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount >= 0),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own fixed expenses" ON public.fixed_expenses;
CREATE POLICY "Users manage own fixed expenses"
  ON public.fixed_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_user ON public.fixed_expenses(user_id);

-- 4. ABASTECIMENTOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fuel_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('automatic', 'manual')),
  price_per_liter numeric(10, 3) NOT NULL CHECK (price_per_liter > 0),
  total_cost numeric(10, 2) NOT NULL CHECK (total_cost > 0),
  liters numeric(10, 3) NOT NULL CHECK (liters > 0),
  km_current integer NOT NULL CHECK (km_current >= 0),
  km_since_last integer NOT NULL DEFAULT 0 CHECK (km_since_last >= 0),
  consumption numeric(10, 2) DEFAULT 0 CHECK (consumption >= 0),
  cost_per_km numeric(10, 3) DEFAULT 0 CHECK (cost_per_km >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fuel_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own fuel entries" ON public.fuel_entries;
CREATE POLICY "Users manage own fuel entries"
  ON public.fuel_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fuel_entries_user_date ON public.fuel_entries(user_id, created_at DESC);

-- 5. ESTADO DO VEÍCULO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_km integer NOT NULL CHECK (current_km >= 0),
  last_updated timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vehicle_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own vehicle state" ON public.vehicle_states;
CREATE POLICY "Users manage own vehicle state"
  ON public.vehicle_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. LEMBRETES DE ÓLEO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.oil_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  interval_km integer NOT NULL DEFAULT 5000 CHECK (interval_km > 0),
  last_change_km integer NOT NULL CHECK (last_change_km >= 0),
  last_change_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.oil_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own oil reminders" ON public.oil_reminders;
CREATE POLICY "Users manage own oil reminders"
  ON public.oil_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. SESSÕES DE TRABALHO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own work sessions" ON public.work_sessions;
CREATE POLICY "Users manage own work sessions"
  ON public.work_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_work_sessions_user_time ON public.work_sessions(user_id, start_time DESC);

-- 8. TRIGGERS PARA updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS set_updated_at_transactions ON public.transactions;
CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_fixed_expenses ON public.fixed_expenses;
CREATE TRIGGER set_updated_at_fixed_expenses
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_oil_reminders ON public.oil_reminders;
CREATE TRIGGER set_updated_at_oil_reminders
  BEFORE UPDATE ON public.oil_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();