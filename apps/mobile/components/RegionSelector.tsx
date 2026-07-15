import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import { useRegion } from '../hooks/useRegion';
import { REGIONS } from '../lib/regions';
import { BRAND } from '@gastocheck/shared';

export function RegionSelector() {
  const { region, setRegion, availableRegions } = useRegion();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>🌍 Región / Region</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.buttonGroup}>
          {availableRegions.map(code => {
            const regionInfo = REGIONS[code];
            return (
              <TouchableOpacity
                key={code}
                style={[
                  styles.button,
                  region === code && styles.buttonActive,
                ]}
                onPress={() => setRegion(code)}
              >
                <Text style={styles.buttonEmoji}>{regionInfo.emoji}</Text>
                <Text
                  style={[
                    styles.buttonText,
                    region === code && styles.buttonTextActive,
                  ]}
                >
                  {code}
                </Text>
                <Text style={styles.buttonName}>{regionInfo.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Resumen de configuración regional */}
      <View style={styles.summary}>
        <SummaryRow icon="💱" label="Currency" value={REGIONS[region].currency} />
        <SummaryRow icon="🧾" label="Tax System" value={REGIONS[region].taxSystem} />
        <SummaryRow icon="📝" label="Invoice" value={REGIONS[region].invoiceSystem} />
        <SummaryRow icon="🆔" label="ID Type" value={REGIONS[region].idType} />
        <SummaryRow icon="📊" label="Default VAT" value={`${REGIONS[region].defaultVAT}%`} />
      </View>
    </View>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryIcon}>{icon}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#90A4AE',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  scroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#fff',
    alignItems: 'center',
    minWidth: 70,
  },
  buttonActive: {
    borderColor: BRAND.navy,
    backgroundColor: BRAND.navy + '15',
  },
  buttonEmoji: {
    fontSize: 20,
    marginBottom: 2,
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '700',
    color: BRAND.navy,
  },
  buttonTextActive: {
    color: BRAND.navy,
    fontWeight: '800',
  },
  buttonName: {
    fontSize: 9,
    color: '#90A4AE',
    marginTop: 1,
  },
  summary: {
    backgroundColor: '#f5f7fa',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryIcon: {
    fontSize: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#90A4AE',
    fontWeight: '600',
    flex: 1,
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND.navy,
  },
});
