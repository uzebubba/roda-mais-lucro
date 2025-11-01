-- ============================================================================
-- FASE 2: Criar todas as tabelas do sistema com RLS multi-tenant
-- ============================================================================

-- 1. CRIAR ENUM PARA ROLES (sistema de segurança)
-- ============================================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'driver');

-- 2. TABELA DE ROLES SEPARADA (segurança crítica - evita privilege escalation)
-- ============================================================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'driver',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- RLS para user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages all roles"
  ON public.user_roles FOR ALL
  USING (auth.role() = 'service_role');

-- Função security definer para verificar roles (evita recursão em RLS)
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
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. TRANSAÇÕES FINANCEIRAS
-- ============================================================================
CREATE TABLE public.transactions (
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

CREATE POLICY "Users view own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);

-- 4. GASTOS FIXOS
-- ============================================================================
CREATE TABLE public.fixed_expenses (
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

CREATE POLICY "Users manage own fixed expenses"
  ON public.fixed_expenses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fixed_expenses_user ON public.fixed_expenses(user_id);

-- 5. ABASTECIMENTOS
-- ============================================================================
CREATE TABLE public.fuel_entries (
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

CREATE POLICY "Users manage own fuel entries"
  ON public.fuel_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fuel_entries_user_date ON public.fuel_entries(user_id, created_at DESC);

-- 6. ESTADO DO VEÍCULO
-- ============================================================================
CREATE TABLE public.vehicle_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_km integer NOT NULL CHECK (current_km >= 0),
  last_updated timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.vehicle_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own vehicle state"
  ON public.vehicle_states FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. LEMBRETES DE ÓLEO
-- ============================================================================
CREATE TABLE public.oil_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interval_km integer NOT NULL DEFAULT 5000 CHECK (interval_km > 0),
  last_change_km integer NOT NULL CHECK (last_change_km >= 0),
  last_change_date timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.oil_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own oil reminders"
  ON public.oil_reminders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. SESSÕES DE TRABALHO
-- ============================================================================
CREATE TABLE public.work_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own work sessions"
  ON public.work_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_work_sessions_user_time ON public.work_sessions(user_id, start_time DESC);

-- 9. TRIGGERS PARA updated_at
-- ============================================================================
CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER set_updated_at_fixed_expenses
  BEFORE UPDATE ON public.fixed_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER set_updated_at_oil_reminders
  BEFORE UPDATE ON public.oil_reminders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================
COMMENT ON TABLE public.transactions IS 'Transações financeiras (receitas e despesas) - isoladas por usuário';
COMMENT ON TABLE public.fixed_expenses IS 'Gastos fixos mensais - isolados por usuário';
COMMENT ON TABLE public.fuel_entries IS 'Histórico de abastecimentos com cálculos de consumo - isolados por usuário';
COMMENT ON TABLE public.vehicle_states IS 'Estado atual do veículo (KM) - um por usuário';
COMMENT ON TABLE public.oil_reminders IS 'Configurações de lembrete de troca de óleo - um por usuário';
COMMENT ON TABLE public.work_sessions IS 'Sessões de trabalho para rastreamento de horas - isoladas por usuário';
COMMENT ON TABLE public.user_roles IS 'Sistema de roles separado para segurança - previne privilege escalation';