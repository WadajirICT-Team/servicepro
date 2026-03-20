-- Business settings table (single-row for company info)
CREATE TABLE public.business_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT '',
  company_phone TEXT NOT NULL DEFAULT '',
  company_email TEXT NOT NULL DEFAULT '',
  company_address TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  currency_symbol TEXT NOT NULL DEFAULT '$',
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- App config table (key/value store for dynamic lists)
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Business settings RLS policies
CREATE POLICY "Staff can view business settings" ON public.business_settings
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert business settings" ON public.business_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update business settings" ON public.business_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- App config RLS policies
CREATE POLICY "Staff can view app config" ON public.app_config
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Admins can insert app config" ON public.app_config
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update app config" ON public.app_config
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at triggers
CREATE TRIGGER update_business_settings_updated_at BEFORE UPDATE ON public.business_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default business settings row
INSERT INTO public.business_settings (company_name, company_phone, company_email, company_address, currency_symbol, tax_rate)
VALUES ('', '', '', '', '$', 0);

-- Seed default app config entries
INSERT INTO public.app_config (key, value) VALUES
  ('expense_categories', '["parts", "fuel", "tools", "office", "utilities", "salary", "marketing", "general"]'::jsonb),
  ('appliance_types', '[{"value": "washing_machine", "label": "Washing Machine"}, {"value": "refrigerator", "label": "Refrigerator"}, {"value": "air_conditioner", "label": "Air Conditioner"}, {"value": "dishwasher", "label": "Dishwasher"}, {"value": "microwave", "label": "Microwave"}, {"value": "oven", "label": "Oven"}, {"value": "dryer", "label": "Dryer"}, {"value": "other", "label": "Other"}]'::jsonb);
