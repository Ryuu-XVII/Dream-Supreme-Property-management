-- Add avatar_key column to user_account table if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_account' 
        AND column_name = 'avatar_key'
    ) THEN
        ALTER TABLE public.user_account ADD COLUMN avatar_key text;
    END IF;
END $$;
