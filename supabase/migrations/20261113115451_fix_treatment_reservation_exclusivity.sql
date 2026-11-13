/*
# Enforce exclusive sale treatment reservations

1. Purpose
- Prevent two backoffice users from reserving the same internal-treatment sale.
- Keep the first reservation owner unchanged when another user tries to start treatment.

2. Modified database objects
- Replace `start_treatment(uuid)`.
- The update now succeeds only when the sale has no reservation or is already reserved by the current user.
- A clear exception is raised when another user already owns the reservation.

3. Security
- The existing admin/BO authentication check remains in place.
- The function remains SECURITY DEFINER and keeps its existing authenticated grant.

4. Data safety
- No rows are deleted and no columns are changed.
- Existing reservations are never overwritten by another user.
*/

CREATE OR REPLACE FUNCTION start_treatment(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_role text;
  v_user_id uuid := auth.uid();
  v_reserved_by uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_user_id;
  IF v_user_role NOT IN ('admin', 'bo') THEN
    RAISE EXCEPTION 'Only admin/bo can start treatment';
  END IF;

  UPDATE sales
  SET treatment_reserved_by = v_user_id,
      treatment_reserved_at = COALESCE(treatment_reserved_at, now()),
      internal_treatment = true
  WHERE id = p_sale_id
    AND internal_treatment = true
    AND (treatment_reserved_by IS NULL OR treatment_reserved_by = v_user_id)
  RETURNING treatment_reserved_by INTO v_reserved_by;

  IF v_reserved_by IS NULL THEN
    SELECT treatment_reserved_by INTO v_reserved_by
    FROM sales
    WHERE id = p_sale_id;

    IF v_reserved_by IS NULL THEN
      RAISE EXCEPTION 'Sale not found or not available for treatment';
    END IF;

    RAISE EXCEPTION 'This sale is already reserved for treatment';
  END IF;

  DELETE FROM alerts WHERE sale_id = p_sale_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION start_treatment(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION start_treatment(uuid) FROM anon;