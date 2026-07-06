import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';
import { trialDaysRemaining, isTrialActive } from '../lib/trial';
import { getActiveMembership } from '../lib/membership';

interface Props {
  onUpgrade?: () => void;
}

export default function TrialBanner({ onUpgrade }: Props) {
  const router = useRouter();
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [loaded,      setLoaded]      = useState(false);

  useEffect(() => {
    loadTrialStatus();
  }, []);

  async function loadTrialStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const member = await getActiveMembership(user.id);
    if (member) {
      const { data: co } = await supabase.from('companies').select('trial_ends_at').eq('id', member.company_id).maybeSingle();
      setTrialEndsAt((co as any)?.trial_ends_at ?? null);
    }
    setLoaded(true);
  }

  if (!loaded || !trialEndsAt || !isTrialActive(trialEndsAt)) return null;

  const days = trialDaysRemaining(trialEndsAt);

  if (days > 7) return null; // No molestar hasta los últimos 7 días

  const urgent  = days <= 3;
  const expired = days <= 0;

  return (
    <View style={[styles.banner, urgent && styles.bannerUrgent]}>
      <Text style={[styles.text, urgent && styles.textUrgent]}>
        {expired
          ? '⚠️ Tu período de prueba ha terminado'
          : `⏳ Prueba gratuita: ${days} día${days !== 1 ? 's' : ''} restante${days !== 1 ? 's' : ''}`}
      </Text>
      <TouchableOpacity style={[styles.btn, urgent && styles.btnUrgent]} onPress={() => { onUpgrade?.(); router.push('/billing' as any); }}>
        <Text style={[styles.btnText, urgent && styles.btnTextUrgent]}>
          {expired ? 'Activar plan' : 'Ver planes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner:       {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#E3F2FD', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#BBDEFB',
  },
  bannerUrgent: { backgroundColor: '#FFF3E0', borderBottomColor: '#FFE0B2' },
  text:         { fontSize: 12, color: BRAND.navy, flex: 1 },
  textUrgent:   { color: '#E65100' },
  btn:          {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    backgroundColor: BRAND.blue, marginLeft: 8,
  },
  btnUrgent:    { backgroundColor: BRAND.orange },
  btnText:      { fontSize: 12, fontWeight: '700', color: '#fff' },
  btnTextUrgent: { color: '#fff' },
});
