-- Mark all attachments older than 5 days as expired and clear path
-- This removes the file references from the sales table
-- Storage cleanup will be handled separately

-- Update sales.attachments
UPDATE sales s
SET attachments = (
  SELECT jsonb_agg(
    CASE 
      WHEN (att->>'uploaded_at')::timestamptz < NOW() - INTERVAL '5 days'
           AND (att->>'expired')::boolean IS NOT TRUE
      THEN jsonb_build_object(
        'id', att->>'id',
        'filename', att->>'filename',
        'uploaded_at', att->>'uploaded_at',
        'uploaded_by', att->>'uploaded_by',
        'expired', true,
        'expired_at', NOW()::text
      )
      ELSE att
    END
  )
  FROM jsonb_array_elements(COALESCE(s.attachments, '[]'::jsonb)) AS att
)
WHERE EXISTS (
  SELECT 1 
  FROM jsonb_array_elements(COALESCE(s.attachments, '[]'::jsonb)) AS att
  WHERE (att->>'uploaded_at')::timestamptz < NOW() - INTERVAL '5 days'
    AND (att->>'expired')::boolean IS NOT TRUE
    AND att->>'path' IS NOT NULL
);

-- Update sales.notes attachments
UPDATE sales s
SET notes = (
  SELECT jsonb_agg(
    CASE 
      WHEN note->>'attachments' IS NOT NULL
      THEN jsonb_set(
        note,
        '{attachments}',
        (
          SELECT jsonb_agg(
            CASE 
              WHEN (att->>'uploaded_at')::timestamptz < NOW() - INTERVAL '5 days'
                   AND (att->>'expired')::boolean IS NOT TRUE
              THEN jsonb_build_object(
                'id', att->>'id',
                'filename', att->>'filename',
                'uploaded_at', att->>'uploaded_at',
                'uploaded_by', att->>'uploaded_by',
                'expired', true,
                'expired_at', NOW()::text
              )
              ELSE att
            END
          )
          FROM jsonb_array_elements(COALESCE(note->'attachments', '[]'::jsonb)) AS att
        )
      )
      ELSE note
    END
  )
  FROM jsonb_array_elements(COALESCE(s.notes, '[]'::jsonb)) AS note
)
WHERE EXISTS (
  SELECT 1 
  FROM jsonb_array_elements(COALESCE(s.notes, '[]'::jsonb)) AS note,
       jsonb_array_elements(COALESCE(note->'attachments', '[]'::jsonb)) AS att
  WHERE (att->>'uploaded_at')::timestamptz < NOW() - INTERVAL '5 days'
    AND (att->>'expired')::boolean IS NOT TRUE
    AND att->>'path' IS NOT NULL
);
