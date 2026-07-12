-- FacturaCheck: cfdi_issue_requests permitía 'supervisor' pero no
-- 'contador_general' (rol real de contador en producción, junto con
-- 'supervisor') — mismo patrón de rol-drift corregido ya esta noche en
-- BancoCheck (bank_reconciliations/accounting_vouchers) y en la Edge
-- Function timbrar-cfdi.
drop policy if exists "member_see_cfdi_requests" on cfdi_issue_requests;
create policy "member_see_cfdi_requests" on cfdi_issue_requests
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_issue_requests.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant','contador_general')
    )
  );

drop policy if exists "member_manage_cfdi_requests" on cfdi_issue_requests;
create policy "member_manage_cfdi_requests" on cfdi_issue_requests
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = cfdi_issue_requests.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant','contador_general')
    )
  );
