-- Migration: Agent Compliance Documents & FFC Self-Service Access
-- Description: Enables agents to view and manage their own FFC certificate records and adds index for user compliance documents.

-- 1. Ensure agents can view and manage their own FFC certificate records
DROP POLICY IF EXISTS "Users view own or agency FFCs" ON public.ffc_certificate;
DROP POLICY IF EXISTS "Users manage own or managers manage agency FFCs" ON public.ffc_certificate;
DROP POLICY IF EXISTS "Managers can manage FFCs" ON public.ffc_certificate;

CREATE POLICY "Users view own or agency FFCs" ON public.ffc_certificate
FOR SELECT
USING (
  user_account_id = public.get_current_user_account_id()
  OR (
    public.get_current_role() IN ('principal', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.user_account u
      WHERE u.id = ffc_certificate.user_account_id
        AND u.agency_id = public.get_current_agency_id()
    )
  )
);

CREATE POLICY "Users manage own or managers manage agency FFCs" ON public.ffc_certificate
FOR ALL
USING (
  user_account_id = public.get_current_user_account_id()
  OR (
    public.get_current_role() IN ('principal', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.user_account u
      WHERE u.id = ffc_certificate.user_account_id
        AND u.agency_id = public.get_current_agency_id()
    )
  )
)
WITH CHECK (
  user_account_id = public.get_current_user_account_id()
  OR (
    public.get_current_role() IN ('principal', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.user_account u
      WHERE u.id = ffc_certificate.user_account_id
        AND u.agency_id = public.get_current_agency_id()
    )
  )
);

-- 2. Index user-attached compliance documents
CREATE INDEX IF NOT EXISTS idx_document_user_account_category
  ON public.document (agency_id, user_account_id, category, uploaded_at DESC);
