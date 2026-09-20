-- ========================================================
-- جدول تتبع زيارات تليجرام في Supabase (PostgreSQL)
-- انسخ هذا الكود والصقه في SQL Editor داخل لوحة تحكم Supabase
-- ========================================================

CREATE TABLE IF NOT EXISTS public.telegram_visits (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  is_bot INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل حماية الأسطر (Row Level Security)
ALTER TABLE public.telegram_visits ENABLE ROW LEVEL SECURITY;

-- السماح بتسجيل الزيارات من السيرفر والتطبيق (Insert)
CREATE POLICY "Allow insert to telegram_visits" 
ON public.telegram_visits FOR INSERT 
TO anon, authenticated, service_role 
WITH CHECK (true);

-- السماح بقراءة الإحصائيات (Select)
CREATE POLICY "Allow read telegram_visits" 
ON public.telegram_visits FOR SELECT 
TO anon, authenticated, service_role 
USING (true);

-- فهارس لتحسين سرعة الاستعلامات والتقارير
CREATE INDEX IF NOT EXISTS idx_telegram_visits_created_at ON public.telegram_visits(created_at);
CREATE INDEX IF NOT EXISTS idx_telegram_visits_is_bot ON public.telegram_visits(is_bot);
