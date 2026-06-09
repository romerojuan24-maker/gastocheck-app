// CategoryPicker — selector modal de categorías de gasto
// Carga las categorías activas de la empresa desde Supabase y permite seleccionar una.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Category {
  id:          string;
  name:        string;
  parent_name: string | null;
  acct_code:   string | null;
}

interface Props {
  visible:     boolean;
  company_id:  string;
  selected_id?: string | null;
  onSelect:    (id: string, name: string) => void;
  onClose:     () => void;
}

export function CategoryPicker({ visible, company_id, selected_id, onSelect, onClose }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');

  const loadCategories = useCallback(async () => {
    if (!company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('expense_categories')
      .select('id, name, parent_name:parent_id(name), acct_code')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name');
    setCategories((data ?? []) as unknown as Category[]);
    setLoading(false);
  }, [company_id]);

  useEffect(() => {
    if (visible) { loadCategories(); setSearch(''); }
  }, [visible, loadCategories]);

  const filtered = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  // Agrupar por parent_name
  const groups: Record<string, Category[]> = {};
  for (const c of filtered) {
    const g = (c.parent_name as any)?.name ?? 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  }

  const sections = Object.entries(groups);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Seleccionar categoría</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Búsqueda */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar categoría..."
            placeholderTextColor="#B0BEC5"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={sections}
            keyExtractor={([g]) => g}
            renderItem={({ item: [group, cats] }) => (
              <View>
                <Text style={styles.groupLabel}>{group}</Text>
                {cats.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.item, selected_id === c.id && styles.itemSelected]}
                    onPress={() => { onSelect(c.id, c.name); onClose(); }}
                  >
                    <Text style={[styles.itemText, selected_id === c.id && styles.itemTextSelected]}>
                      {c.name}
                    </Text>
                    {c.acct_code && (
                      <Text style={styles.acctCode}>{c.acct_code}</Text>
                    )}
                    {selected_id === c.id && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {search ? `Sin resultados para "${search}"` : 'No hay categorías'}
              </Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: BRAND.gray },
  header:          {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  title:           { fontSize: 18, fontWeight: '700', color: BRAND.navy },
  closeBtn:        { fontSize: 20, color: '#90A4AE', paddingHorizontal: 8 },
  searchBar:       {
    margin: 12, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchInput:     { fontSize: 14, color: BRAND.navy },
  groupLabel:      {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    fontSize: 12, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item:            {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 4,
    borderRadius: 10, padding: 14,
  },
  itemSelected:    { backgroundColor: BRAND.blue + '15', borderWidth: 1, borderColor: BRAND.blue },
  itemText:        { flex: 1, fontSize: 15, color: BRAND.navy, fontWeight: '500' },
  itemTextSelected:{ color: BRAND.blue, fontWeight: '700' },
  acctCode:        { fontSize: 12, color: '#90A4AE', marginRight: 8 },
  check:           { fontSize: 16, color: BRAND.blue, fontWeight: '700' },
  empty:           { textAlign: 'center', color: '#90A4AE', padding: 32 },
});
