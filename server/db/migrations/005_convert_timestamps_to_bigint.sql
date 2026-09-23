DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sessions'
      AND column_name = 'expires_at'
      AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
  ) THEN
    ALTER TABLE sessions
      ALTER COLUMN expires_at TYPE BIGINT
      USING (EXTRACT(EPOCH FROM expires_at) * 1000)::BIGINT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_tokens'
      AND column_name = 'expires_at'
      AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
  ) THEN
    ALTER TABLE password_reset_tokens
      ALTER COLUMN expires_at TYPE BIGINT
      USING (EXTRACT(EPOCH FROM expires_at) * 1000)::BIGINT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'password_reset_tokens'
      AND column_name = 'created_at'
      AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
  ) THEN
    ALTER TABLE password_reset_tokens
      ALTER COLUMN created_at TYPE BIGINT
      USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
  END IF;
END
$$;