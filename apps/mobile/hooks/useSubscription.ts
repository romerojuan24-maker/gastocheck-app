import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  type SubscriptionStatus,
  isSubscriptionActive,
  isSubscriptionGracePeriod,
  isSubscriptionBlocked,
  subscriptionStatusLabel,
} from '@gastocheck/shared';

export interface CompanySubscription {
  plan_code:               string | null;
  status:                  SubscriptionStatus | null;
  trial_end:               string | null;
  current_period_end:      string | null;
  cancel_at_period_end:    boolean;
  max_users:               number;
  max_receipts_per_month:  number;
  sat_validation_enabled:  boolean;
  collections_enabled:     boolean;
  fleet_vertical_enabled:  boolean;
}

const FREE_TIER: CompanySubscription = {
  plan_code:               null,
  status:                  null,
  trial_end:               null,
  current_period_end:      null,
  cancel_at_period_end:    false,
  max_users:               2,
  max_receipts_per_month:  20,
  sat_validation_enabled:  false,
  collections_enabled:     false,
  fleet_vertical_enabled:  false,
};

export function useSubscription(companyId: string | null) {
  const [subscription, setSubscription] = useState<CompanySubscription>(FREE_TIER);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!companyId) {
      setSubscription(FREE_TIER);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .rpc('get_company_subscription', { p_company_id: companyId })
      .maybeSingle();

    if (error) {
      console.warn('useSubscription error:', error.message);
      setSubscription(FREE_TIER);
    } else if (!data) {
      setSubscription(FREE_TIER);
    } else {
      setSubscription({
        plan_code:               data.plan_code,
        status:                  data.status as SubscriptionStatus,
        trial_end:               data.trial_end,
        current_period_end:      data.current_period_end,
        cancel_at_period_end:    data.cancel_at_period_end ?? false,
        max_users:               data.max_users ?? 2,
        max_receipts_per_month:  data.max_receipts_per_month ?? 20,
        sat_validation_enabled:  data.sat_validation_enabled ?? false,
        collections_enabled:     data.collections_enabled ?? false,
        fleet_vertical_enabled:  data.fleet_vertical_enabled ?? false,
      });
    }

    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    refresh: fetchSubscription,

    // Flags de acceso derivados
    isPremium:      isSubscriptionActive(subscription.status),
    isGracePeriod:  isSubscriptionGracePeriod(subscription.status),
    isBlocked:      isSubscriptionBlocked(subscription.status),
    statusLabel:    subscriptionStatusLabel(subscription.status),

    // Feature gates individuales
    canUseSat:       subscription.sat_validation_enabled && !isSubscriptionBlocked(subscription.status),
    canUseCollections: subscription.collections_enabled && !isSubscriptionBlocked(subscription.status),
    canUseFleet:     subscription.fleet_vertical_enabled && !isSubscriptionBlocked(subscription.status),
  };
}
