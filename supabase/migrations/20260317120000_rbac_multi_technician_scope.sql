-- Align RLS with multi-technician assignments (ticket_technicians)
-- Goal: technicians only see/update tickets they are assigned to; admins can see/update all.
-- Also align ticket creation/assignment with UI (admins manage).

-- Helper predicate: does current user have an assigned profile on this ticket?
-- (inline EXISTS blocks are used in policies below to avoid creating extra functions)

-- ---------------------------------------------------------------------------
-- service_tickets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view tickets" ON public.service_tickets;
CREATE POLICY "Staff can view tickets" ON public.service_tickets
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = service_tickets.id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can update tickets" ON public.service_tickets;
CREATE POLICY "Staff can update tickets" ON public.service_tickets
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = service_tickets.id
        AND p.user_id = auth.uid()
    )
  );

-- UI only allows admins to create tickets
DROP POLICY IF EXISTS "Staff can create tickets" ON public.service_tickets;
CREATE POLICY "Admins can create tickets" ON public.service_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- ticket_technicians (assignment table)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view ticket_technicians" ON public.ticket_technicians;
CREATE POLICY "Staff can view ticket_technicians" ON public.ticket_technicians
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = ticket_technicians.technician_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can assign technicians" ON public.ticket_technicians;
CREATE POLICY "Admins can assign technicians" ON public.ticket_technicians
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Staff can unassign technicians" ON public.ticket_technicians;
CREATE POLICY "Admins can unassign technicians" ON public.ticket_technicians
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- ticket_notes (scope to accessible tickets)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view notes" ON public.ticket_notes;
CREATE POLICY "Staff can view notes" ON public.ticket_notes
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = ticket_notes.ticket_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can add notes" ON public.ticket_notes;
CREATE POLICY "Staff can add notes" ON public.ticket_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = ticket_notes.ticket_id
        AND p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- parts_used (scope to accessible tickets)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff can view parts" ON public.parts_used;
CREATE POLICY "Staff can view parts" ON public.parts_used
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = parts_used.ticket_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can add parts" ON public.parts_used;
CREATE POLICY "Staff can add parts" ON public.parts_used
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = parts_used.ticket_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can update parts" ON public.parts_used;
CREATE POLICY "Staff can update parts" ON public.parts_used
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = parts_used.ticket_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can delete parts" ON public.parts_used;
CREATE POLICY "Staff can delete parts" ON public.parts_used
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.ticket_technicians tt
      JOIN public.profiles p ON p.id = tt.technician_id
      WHERE tt.ticket_id = parts_used.ticket_id
        AND p.user_id = auth.uid()
    )
  );

