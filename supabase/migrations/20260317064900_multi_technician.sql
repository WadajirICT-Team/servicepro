-- Multi-technician ticket assignment migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Create junction table for many-to-many ticket <-> technician
CREATE TABLE public.ticket_technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE CASCADE NOT NULL,
  technician_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, technician_id)
);

-- 2. Enable RLS
ALTER TABLE public.ticket_technicians ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (match service_tickets pattern)
CREATE POLICY "Staff can view ticket_technicians" ON public.ticket_technicians
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can assign technicians" ON public.ticket_technicians
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can unassign technicians" ON public.ticket_technicians
  FOR DELETE TO authenticated USING (public.is_staff(auth.uid()));

-- 4. Migrate existing single-assigned data into junction table
INSERT INTO public.ticket_technicians (ticket_id, technician_id)
SELECT id, assigned_technician_id FROM public.service_tickets
WHERE assigned_technician_id IS NOT NULL
ON CONFLICT DO NOTHING;
