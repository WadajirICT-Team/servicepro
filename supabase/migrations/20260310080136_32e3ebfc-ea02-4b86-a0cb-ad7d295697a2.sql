
-- Fix profiles SELECT policy to be PERMISSIVE
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
CREATE POLICY "Staff can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- Fix user_roles SELECT policy to be PERMISSIVE
DROP POLICY IF EXISTS "Staff can view roles" ON public.user_roles;
CREATE POLICY "Staff can view roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

-- Fix profiles INSERT policy to be PERMISSIVE
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix profiles UPDATE policy to be PERMISSIVE (and allow admins to update any profile)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own or admin update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- Fix profiles DELETE policy to be PERMISSIVE
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix service_tickets policies to be PERMISSIVE
DROP POLICY IF EXISTS "Staff can view tickets" ON public.service_tickets;
CREATE POLICY "Staff can view tickets"
ON public.service_tickets FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = service_tickets.assigned_technician_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Staff can create tickets" ON public.service_tickets;
CREATE POLICY "Staff can create tickets"
ON public.service_tickets FOR INSERT
TO authenticated
WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update tickets" ON public.service_tickets;
CREATE POLICY "Staff can update tickets"
ON public.service_tickets FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = service_tickets.assigned_technician_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Admins can delete tickets" ON public.service_tickets;
CREATE POLICY "Admins can delete tickets"
ON public.service_tickets FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix customers policies
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;
CREATE POLICY "Staff can view customers"
ON public.customers FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert customers" ON public.customers;
CREATE POLICY "Staff can insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update customers" ON public.customers;
CREATE POLICY "Staff can update customers"
ON public.customers FOR UPDATE TO authenticated
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;
CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix expenses policies
DROP POLICY IF EXISTS "Staff can view expenses" ON public.expenses;
CREATE POLICY "Staff can view expenses"
ON public.expenses FOR SELECT TO authenticated
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can add expenses" ON public.expenses;
CREATE POLICY "Staff can add expenses"
ON public.expenses FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Admins can update expenses" ON public.expenses;
CREATE POLICY "Admins can update expenses"
ON public.expenses FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
CREATE POLICY "Admins can delete expenses"
ON public.expenses FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix user_roles ALL policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix parts_used policies
DROP POLICY IF EXISTS "Staff can view parts" ON public.parts_used;
CREATE POLICY "Staff can view parts"
ON public.parts_used FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM service_tickets st JOIN profiles p ON p.id = st.assigned_technician_id
  WHERE st.id = parts_used.ticket_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Staff can add parts" ON public.parts_used;
CREATE POLICY "Staff can add parts"
ON public.parts_used FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can update parts" ON public.parts_used;
CREATE POLICY "Staff can update parts"
ON public.parts_used FOR UPDATE TO authenticated
USING (is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can delete parts" ON public.parts_used;
CREATE POLICY "Staff can delete parts"
ON public.parts_used FOR DELETE TO authenticated
USING (is_staff(auth.uid()));

-- Fix ticket_notes policies
DROP POLICY IF EXISTS "Staff can view notes" ON public.ticket_notes;
CREATE POLICY "Staff can view notes"
ON public.ticket_notes FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (
  SELECT 1 FROM service_tickets st JOIN profiles p ON p.id = st.assigned_technician_id
  WHERE st.id = ticket_notes.ticket_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "Staff can add notes" ON public.ticket_notes;
CREATE POLICY "Staff can add notes"
ON public.ticket_notes FOR INSERT TO authenticated
WITH CHECK (is_staff(auth.uid()));
