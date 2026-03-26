/*
  # Add Partner UPDATE Policy for Own Sales

  ## Problem
  The existing "Partners add notes" UPDATE policy was the only UPDATE policy for partners,
  which only allowed updating sales (any field) on their own partner's sales. However, in
  practice the RLS was preventing partners from editing their own sales because the service
  layer sends all form fields (including status, contact, address, operator, etc.) and the
  policy was named/intended only for notes.

  The root issue: when a partner submits the edit form, salesService.update() sends all
  fields in a single UPDATE statement. Since there was no explicit broad UPDATE policy for
  partners, Supabase was silently returning data: null (RLS blocked), causing the service
  to throw "Sale update failed".

  ## Fix
  Drop the ambiguously named "Partners add notes" policy and replace it with a clear
  "Partners can update own sales" policy that allows partners to update all fields on
  their own partner's sales (same ownership check: partner_id = get_user_partner_id()).

  Also add the same for partner_commercial role (they can update sales they created).

  ## Security
  - Partners can only update sales where partner_id matches their own partner id
  - partner_commercial can only update sales they personally created
  - No change to admin/bo update permissions
*/

DROP POLICY IF EXISTS "Partners add notes" ON sales;

CREATE POLICY "Partners can update own sales"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (
    has_role('partner'::text) AND partner_id = get_user_partner_id()
  )
  WITH CHECK (
    has_role('partner'::text) AND partner_id = get_user_partner_id()
  );

CREATE POLICY "Partner commercials can update own created sales"
  ON sales
  FOR UPDATE
  TO authenticated
  USING (
    has_role('partner_commercial'::text) AND created_by_user_id = auth.uid()
  )
  WITH CHECK (
    has_role('partner_commercial'::text) AND created_by_user_id = auth.uid()
  );
