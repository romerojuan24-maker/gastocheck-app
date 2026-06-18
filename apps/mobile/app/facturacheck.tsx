import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Share,
} from 'react-native';
import { BRAND, CFDI_STATUS_META } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface CfdiDocument {
  id:                 string;
  direction:          string;
  uuid_cfdi:          string;
  rfc_emisor:         string;
  razon_social_emisor: string | null;
  rfc_receptor:       string;
  total:              number | null;
  status:             string;
  fecha_emision:      string | null;
}

const money = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function FacturaCheckScreen() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [cfdis, setCfdis] = useState<CfdiDocument[]>([]);
  const [tab, setTab] = useState<'received' | 'problems'>('received');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (cid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cfdi_documents')
        .select('*').eq('company_id', cid)
        .order('created_at', { ascending: false })
        .limit(100);
      setCfdis((data ?? []) as CfdiDocument[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: m } = await supabase
        .from('company_members').select('company_id')
        .eq('user_id', session.user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!m) return;
      setCompanyId(m.company_id);
      load(m.company_id);
    })();
  }, [load]);

  const filtered = cfdis.filter(c => {
    if (tab === 'received') return c.direction === 'received' && c.status !== 'cancelado';
    return ['cancelado','not_found','duplicate'].includes(c.status);
  });

  const vigentCount = cfdis.filter(c => c.direction === 'received' && c.status === 'vigente').length;
  const problemCount = cfdis.filter(c => ['cancelado','not_found','duplicate'].includes(c.status)).length;

  return (
    <View style={{ flex: 1, backgroundColor: BRAND.gray }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: 52 }]}>
        <Text style={styles.headerTitle}>📄 FacturaCheck</Text>
        <Text style={styles.headerSubtitle}>Gestión de CFDI</Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{vigentCount}</Text>
            <Text style={styles.statLabel}>Vigentes</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{problemCount}</Text>
            <Text style={styles.statLabel}>Problemas</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: 'received', label: `Recibidas (${cfdis.filter(c => c.direction === 'received').length})` },
          { key: 'problems', label: `Problemas (${problemCount})` },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            onPress={() => setTab(t.key as any)}
            style={[
              styles.tab,
              tab === t.key && styles.tabActive,
            ]}
          >
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={BRAND.blue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>
            {tab === 'problems' ? 'Sin problemas' : 'Sin CFDI'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: c }) => {
            const meta = CFDI_STATUS_META[c.status as keyof typeof CFDI_STATUS_META] || {
              label: c.status, color: '#999', icon: '?',
            };
            return (
              <TouchableOpacity
                style={styles.cfdiCard}
                onPress={() => Alert.alert('UUID', c.uuid_cfdi)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cfdiUuid} numberOfLines={1}>
                    {c.uuid_cfdi}
                  </Text>
                  <Text style={styles.cfdiEmitter}>
                    {c.razon_social_emisor || c.rfc_emisor}
                  </Text>
                  <Text style={styles.cfdiDate}>
                    {c.fecha_emision ? new Date(c.fecha_emision).toLocaleDateString('es-MX') : 'Sin fecha'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {c.total && (
                    <Text style={styles.cfdiTotal}>{money(c.total)}</Text>
                  )}
                  <View style={[styles.statusBadge, { borderColor: meta.color }]}>
                    <Text style={[styles.statusBadgeIcon, { color: meta.color }]}>
                      {meta.icon}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { backgroundColor: BRAND.navy, padding: 20, paddingBottom: 24 },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle:  { fontSize: 13, color: '#90A4AE', marginTop: 2, marginBottom: 12 },
  statsRow:        { flexDirection: 'row', gap: 16 },
  stat:            { flex: 1 },
  statValue:       { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel:       { fontSize: 10, color: '#90A4AE', marginTop: 2 },

  tabBar:          { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  tab:             { flex: 1, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive:       { borderBottomColor: BRAND.blue },
  tabLabel:        { fontSize: 12, fontWeight: '600', color: '#90A4AE', textAlign: 'center' },
  tabLabelActive:  { color: BRAND.blue },

  center:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:       { fontSize: 48, marginBottom: 12 },
  emptyText:       { fontSize: 14, color: '#90A4AE', textAlign: 'center' },

  listContent:     { padding: 16, paddingBottom: 40, gap: 10 },
  cfdiCard:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  cfdiUuid:        { fontSize: 12, fontWeight: '700', color: BRAND.navy, fontFamily: 'Courier New' },
  cfdiEmitter:     { fontSize: 11, color: '#90A4AE', marginTop: 4 },
  cfdiDate:        { fontSize: 10, color: '#B0BEC5', marginTop: 2 },
  cfdiTotal:       { fontSize: 14, fontWeight: '800', color: BRAND.navy, marginBottom: 6 },
  statusBadge:     { borderWidth: 1.5, borderRadius: 6, padding: 4 },
  statusBadgeIcon: { fontSize: 12, fontWeight: '700' },
});
