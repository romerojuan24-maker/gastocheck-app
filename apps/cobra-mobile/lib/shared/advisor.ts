// ── Advisor IA — tipos compartidos ───────────────────────────────────────────

export type AdvisorInsightType =
  | 'collections_priority'
  | 'unusual_expense'
  | 'unmatched_bank'
  | 'cash_flow_risk'
  | 'cfdi_problem'
  | 'low_stock'
  | 'action_item'
  | 'overdue_payment'
  | 'budget_alert';

export type AdvisorSeverity = 'info' | 'warning' | 'critical';

export type CheckSuiteModule =
  | 'gastocheck'
  | 'cobracheck'
  | 'bancocheck'
  | 'flujocheck'
  | 'facturacheck'
  | 'inventariocheck';

export interface AdvisorInsight {
  id:           string;
  company_id:   string;
  insight_type: AdvisorInsightType;
  title:        string;
  body:         string;
  severity:     AdvisorSeverity;
  module:       CheckSuiteModule;
  action_url:   string | null;
  related_ids:  Record<string, string[]> | null;
  is_dismissed: boolean;
  is_actioned:  boolean;
  expires_at:   string | null;
  created_at:   string;
}

export interface AdvisorQuestion {
  id:               string;
  company_id:       string;
  user_id:          string;
  question:         string;
  answer:           string | null;
  status:           'pending' | 'answered' | 'error';
  context_snapshot: unknown;
  created_at:       string;
  answered_at:      string | null;
}

export interface OrganizationModule {
  id:                   string;
  company_id:           string;
  module_id:            CheckSuiteModule | 'advisor';
  is_active:            boolean;
  stripe_subscription_id: string | null;
  trial_ends_at:        string | null;
  activated_at:         string | null;
  deactivated_at:       string | null;
  created_at:           string;
  updated_at:           string;
}

export const ADVISOR_SEVERITY_META: Record<AdvisorSeverity, {
  label: string; color: string; bgColor: string; icon: string;
}> = {
  info:     { label: 'Info',      color: '#1565C0', bgColor: '#E3F2FD', icon: 'ℹ'  },
  warning:  { label: 'Atención',  color: '#E65100', bgColor: '#FFF3E0', icon: '⚠'  },
  critical: { label: 'Urgente',   color: '#B71C1C', bgColor: '#FFEBEE', icon: '🔴' },
};

export const MODULE_META: Record<CheckSuiteModule | 'advisor', {
  label: string; icon: string; color: string;
}> = {
  gastocheck:     { label: 'GastoCheck',      icon: '🧾', color: '#1565C0' },
  cobracheck:     { label: 'CobraCheck',       icon: '💰', color: '#36BF6A' },
  bancocheck:     { label: 'BancoCheck',       icon: '🏦', color: '#7B1FA2' },
  flujocheck:     { label: 'FlujoCheck',       icon: '📈', color: '#00ACC1' },
  facturacheck:   { label: 'FacturaCheck',     icon: '📄', color: '#F57C00' },
  inventariocheck:{ label: 'InventarioCheck',  icon: '📦', color: '#5D4037' },
  advisor:        { label: 'Advisor IA',       icon: '🤖', color: '#0F172A' },
};
