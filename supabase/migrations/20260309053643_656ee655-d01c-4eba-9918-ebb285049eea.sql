
-- Update service_tickets SELECT policy: admins see all, technicians see only assigned
DROP POLICY "Staff can view tickets" ON public.service_tickets;
CREATE POLICY "Staff can view tickets" ON public.service_tickets
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = service_tickets.assigned_technician_id
      AND p.user_id = auth.uid()
    )
  );

-- Update service_tickets UPDATE policy: admins can update all, technicians only assigned
DROP POLICY "Staff can update tickets" ON public.service_tickets;
CREATE POLICY "Staff can update tickets" ON public.service_tickets
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = service_tickets.assigned_technician_id
      AND p.user_id = auth.uid()
    )
  );

-- Update ticket_notes SELECT: admins see all, technicians see notes on their assigned tickets
DROP POLICY "Staff can view notes" ON public.ticket_notes;
CREATE POLICY "Staff can view notes" ON public.ticket_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR
    EXISTS (
      SELECT 1 FROM public.service_tickets st
      JOIN public.profiles p ON p.id = st.assigned_technician_id
      WHERE st.id = ticket_notes.ticket_id
      AND p.user_id = auth.uid()
    )
  );

-- Update parts_used SELECT: admins see all, technicians see parts on their assigned tickets
DROP POLICY "Staff can view parts" ON public.parts_used;
CREATE POLICY "Staff can view parts" ON public.parts_used
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR
    EXISTS (
      SELECT 1 FROM public.service_tickets st
      JOIN public.profiles p ON p.id = st.assigned_technician_id
      WHERE st.id = parts_used.ticket_id
      AND p.user_id = auth.uid()
    )
  );

-- Enable realtime for service_tickets
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_tickets;
