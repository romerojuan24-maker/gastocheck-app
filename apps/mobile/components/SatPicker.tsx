// Combobox para catálogos SAT: muestra el valor elegido y abre un modal con la
// lista (buscable) para seleccionar. Permite además captura manual del código
// cuando el catálogo real es enorme (ej. clave producto/servicio).
import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView, TextInput,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import type { SatOption } from '../lib/sat-catalogs';

interface Props {
  label: string;
  value: string;
  options: SatOption[];
  onChange: (code: string) => void;
  allowManual?: boolean;   // permite teclear un código fuera de la lista
  color?: string;
}

export default function SatPicker({ label, value, options, onChange, allowManual, color = BRAND.purple }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(o => o.code === value);
  const display = selected ? selected.label : value || 'Seleccionar…';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.code.toLowerCase().includes(q) || o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <View style={{ marginBottom: 2 }}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={s.field} onPress={() => { setSearch(''); setOpen(true); }} activeOpacity={0.7}>
        <Text style={[s.fieldText, !selected && !value && { color: '#B0BEC5' }]} numberOfLines={1}>{display}</Text>
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{label}</Text>
            <TextInput
              style={s.search}
              placeholder="Buscar por código o nombre…"
              placeholderTextColor="#B0BEC5"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="characters"
            />
            {allowManual && search.trim().length > 0 && !filtered.some(o => o.code === search.trim()) && (
              <TouchableOpacity style={s.manualRow} onPress={() => { onChange(search.trim()); setOpen(false); }}>
                <Text style={s.manualText}>Usar código "{search.trim()}"</Text>
              </TouchableOpacity>
            )}
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {filtered.map(o => (
                <TouchableOpacity
                  key={o.code}
                  style={[s.row, value === o.code && { backgroundColor: color + '12' }]}
                  onPress={() => { onChange(o.code); setOpen(false); }}
                >
                  <Text style={[s.rowText, value === o.code && { color, fontWeight: '800' }]}>{o.label}</Text>
                  {value === o.code && <Text style={{ color, fontWeight: '800' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.cancel} onPress={() => setOpen(false)}>
              <Text style={s.cancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', marginBottom: 6, marginTop: 10 },
  field: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, padding: 13, borderWidth: 1, borderColor: '#E0E0E0' },
  fieldText: { fontSize: 14, color: BRAND.navy, fontWeight: '600', flex: 1, marginRight: 8 },
  chevron: { fontSize: 12, color: '#90A4AE' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 40 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: BRAND.navy, marginBottom: 12 },
  search: { backgroundColor: '#F8F9FB', borderRadius: 10, padding: 11, borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy, marginBottom: 8 },
  manualRow: { paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0F4F8' },
  manualText: { fontSize: 13, fontWeight: '700', color: BRAND.blue },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowText: { fontSize: 13, color: '#455A64', flex: 1, marginRight: 8 },
  cancel: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#90A4AE', fontSize: 14, fontWeight: '700' },
});
