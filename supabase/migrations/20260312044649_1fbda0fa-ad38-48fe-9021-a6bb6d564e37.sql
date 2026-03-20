
-- Make ticket_notes.user_id nullable and add ON DELETE SET NULL
ALTER TABLE public.ticket_notes ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing FK constraints and re-add with ON DELETE SET NULL
-- ticket_notes.user_id
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'ticket_notes' AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.column_name = 'user_id' AND tc.table_schema = 'public';
  
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ticket_notes DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Drop existing FK for expenses.created_by
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'expenses' AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'created_by' AND tc.table_schema = 'public';
  
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.expenses DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;
