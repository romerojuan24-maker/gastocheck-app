// Tipos y constantes de billing GastoCheck

export type PlanCode =
  | 'GC_STARTER_M'
  | 'GC_STARTER_A'
  | 'GC_PRO_M'
  | 'GC_PRO_A'
  | 'GC_BUSINESS_M'
  | 'GC_BUSINESS_A'
  | 'GC_ENTERPRISE_M'
  | 'GC_ENTERPRISE_A';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'paused';

export type BillingInterval = 'month' | 'year';

export interface BillingPlan {
  plan_code:               PlanCode;
  stripe_price_id:         string;
  name:                    string;
  billing_interval:        BillingInterval;
  monthly_price:           number | null;
  annual_price:            number | null;
  max_users:               number;
  max_receipts_per_month:  number;
  max_companies:           number;
  sat_validation_enabled:  boolean;
  collections_enabled:     boolean;
  fleet_vertical_enabled:  boolean;
  status:                  'active' | 'inactive';
}

export interface Subscription {
  id:                    string;
  company_id:            string;
  plan_code:             PlanCode;
  stripe_customer_id:    string | null;
  stripe_subscription_id: string | null;
  status:                SubscriptionStatus;
  trial_start:           string | null;
  trial_end:             string | null;
  current_period_start:  string | null;
  current_period_end:    string | null;
  cancel_at_period_end:  boolean;
  created_at:            string;
  updated_at:            string;
}

// Planes base (sin interval) para mostrar en pricing
export type PlanTier = 'starter' | 'pro' | 'business' | 'enterprise';

export const PLAN_TIER_BY_CODE: Record<PlanCode, PlanTier> = {
  GC_STARTER_M:    'starter',
  GC_STARTER_A:    'starter',
  GC_PRO_M:        'pro',
  GC_PRO_A:        'pro',
  GC_BUSINESS_M:   'business',
  GC_BUSINESS_A:   'business',
  GC_ENTERPRISE_M: 'enterprise',
  GC_ENTERPRISE_A: 'enterprise',
};

export const PLAN_CODE_BY_TIER: Record<PlanTier, { month: PlanCode; year: PlanCode }> = {
  starter:    { month: 'GC_STARTER_M',    year: 'GC_STARTER_A'    },
  pro:        { month: 'GC_PRO_M',        year: 'GC_PRO_A'        },
  business:   { month: 'GC_BUSINESS_M',   year: 'GC_BUSINESS_A'   },
  enterprise: { month: 'GC_ENTERPRISE_M', year: 'GC_ENTERPRISE_A' },
};

/** Devuelve true si la suscripción permite acceso a funciones premium */
export function isSubscriptionActive(status: SubscriptionStatus | null | undefined): boolean {
  return status === 'trialing' || status === 'active';
}

/** Devuelve true si el acceso está degradado (past_due — periodo de gracia) */
export function isSubscriptionGracePeriod(status: SubscriptionStatus | null | undefined): boolean {
  return status === 'past_due';
}

/** Devuelve true si el acceso premium está bloqueado */
export function isSubscriptionBlocked(status: SubscriptionStatus | null | undefined): boolean {
  return status === 'canceled' || status === 'incomplete' || status === 'paused' || !status;
}

/** Devuelve etiqueta legible del status */
export function subscriptionStatusLabel(status: SubscriptionStatus | null | undefined): string {
  const labels: Record<string, string> = {
    trialing:   'Prueba gratuita',
    active:     'Activa',
    past_due:   'Pago pendiente',
    canceled:   'Cancelada',
    incomplete: 'Incompleta',
    paused:     'Pausada',
  };
  return labels[status ?? ''] ?? 'Sin suscripción';
}
