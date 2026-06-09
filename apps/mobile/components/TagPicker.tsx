// TagPicker — selector multi-etiqueta (obra, rancho, ruta, cultivo, etc.)
// Carga etiquetas de la empresa y permite seleccionar varias simultáneamente.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal, View, Text, TouchableOpacity, FlatList,
  TextInput, StyleSheet, ActivityIndicator,
} from 'react-native';
import { BRAND, TAG_TYPE_LABELS } from '@gastocheck/shared';
import type { TagType } from '@gastocheck/shared';
import { supabase } from '../lib/supabase';

interface Tag {
  id:       string;
  tag_type: TagType;
  name:     string;
  color:    string | null;
}

interface Props {
  visible:     boolean;
  company_id:  string;
  selected_ids: string[];
  onConfirm:   (ids: string[], tags: Tag[]) => void;
  onClose:     () => void;
}

const DEFAULT_COLORS: Record<TagType, string> = {
  obra:       '#1565C0',
  rancho:     '#2E7D32',
  cultivo:    '#558B2F',
  ruta:       '#E65100',
  unidad:     '#6A1B9A',
  tecnico:    '#0277BD',
  proyecto:   '#AD1457',
  cliente:    '#4E342E',
  temporada:  '#F57F17',
  lote:       '#00695C',
  maquinaria: '#283593',
  otro:       '#37474F',
};

export function TagPicker({ visible, company_id, selected_ids, onConfirm, onClose }: Props) {
  const [tags,      setTags]      = useState<Tag[]>([]);
  const [selected,  setSelected]  = useState<Set<string>>(new Set(selected_ids));
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [newName,   setNewName]   = useState('');
  const [newType,   setNewType]   = useState<TagType>('obra');
  const [creating,  setCreating]  = useState(false);

  useEffect(() => {
    setSelected(new Set(selected_ids));
  }, [selected_ids]);

  const loadTags = useCallback(async () => {
    if (!company_id) return;
    setLoading(true);
    const { data } = await supabase
      .from('expense_tags')
      .select('id, tag_type, name, color')
      .eq('company_id', company_id)
      .eq('is_active', true)
      .order('tag_type')
      .order('name');
    setTags((data ?? []) as Tag[]);
    setLoading(false);
  }, [company_id]);

  useEffect(() => {
    if (visible) { loadTags(); setSearch(''); }
  }, [visible, loadTags]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function createTag() {
    if (!newName.trim()) return;
    setCreating(true);
    const { data } = await supabase
      .from('expense_tags')
      .insert({ company_id, tag_type: newType, name: newName.trim(), color: DEFAULT_COLORS[newType] })
      .select('id, tag_type, name, color')
      .single();
    if (data) {
      setTags((prev) => [...prev, data as Tag]);
      setSelected((prev) => new Set([...prev, (data as Tag).id]));
      setNewName('');
    }
    setCreating(false);
  }

  const filtered = search.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags;

  // Agrupar por tipo
  const groups: Record<string, Tag[]> = {};
  for (const t of filtered) {
    if (!groups[t.tag_type]) groups[t.tag_type] = [];
    groups[t.tag_type].push(t);
  }

  const handleConfirm = () => {
    const selectedTags = tags.filter((t) => selected.has(t.id));
    onConfirm([...selected], selectedTags);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Etiquetas</Text>
          <TouchableOpacity onPress={handleConfirm}>
            <Text style={styles.confirm}>
              Listo {selected.size > 0 ? `(${selected.size})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Búsqueda */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar etiqueta..."
            placeholderTextColor="#B0BEC5"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={BRAND.blue} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={Object.entries(groups)}
            keyExtractor={([g]) => g}
            renderItem={({ item: [type, items] }) => (
              <View>
                <Text style={styles.groupLabel}>
                  {TAG_TYPE_LABELS[type as TagType] ?? type}
                </Text>
                <View style={styles.chipsRow}>
                  {items.map((t) => {
                    const sel = selected.has(t.id);
                    const color = t.color ?? DEFAULT_COLORS[t.tag_type] ?? '#1565C0';
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.chip, sel && { backgroundColor: color, borderColor: color }]}
                        onPress={() => toggle(t.id)}
                      >
                        <Text style={[styles.chipText, sel && { color: '#fff' }]}>{t.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.newTagSection}>
                <Text style={styles.groupLabel}>Nueva etiqueta</Text>
                {/* Selector de tipo */}
                <View style={styles.typeRow}>
                  {(Object.keys(TAG_TYPE_LABELS) as TagType[]).slice(0, 6).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeChip, newType === t && { backgroundColor: BRAND.blue }]}
                      onPress={() => setNewType(t)}
                    >
                      <Text style={[styles.typeText, newType === t && { color: '#fff' }]}>
                        {TAG_TYPE_LABELS[t]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.newTagRow}>
                  <TextInput
                    style={styles.newTagInput}
                    placeholder={`Nombre (ej: Rancho norte)`}
                    placeholderTextColor="#B0BEC5"
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <TouchableOpacity
                    style={[styles.addBtn, (!newName.trim() || creating) && { opacity: 0.5 }]}
                    onPress={createTag}
                    disabled={!newName.trim() || creating}
                  >
                    <Text style={styles.addBtnText}>{creating ? '...' : '+ Crear'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
            ListEmptyComponent={
              search ? (
                <Text style={styles.empty}>Sin etiquetas para "{search}"</Text>
              ) : (
                <Text style={styles.empty}>Sin etiquetas. Crea la primera abajo.</Text>
              )
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: BRAND.gray },
  header:       {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  title:        { fontSize: 17, fontWeight: '700', color: BRAND.navy },
  cancel:       { fontSize: 15, color: '#90A4AE' },
  confirm:      { fontSize: 15, color: BRAND.blue, fontWeight: '700' },
  searchBar:    {
    margin: 12, backgroundColor: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  searchInput:  { fontSize: 14, color: BRAND.navy },
  groupLabel:   {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6,
    fontSize: 11, fontWeight: '700', color: '#90A4AE', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  chipsRow:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  chip:         {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#E0E0E0',
  },
  chipText:     { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  newTagSection:{ marginTop: 8 },
  typeRow:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  typeChip:     {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  typeText:     { fontSize: 11, color: BRAND.navy, fontWeight: '600' },
  newTagRow:    { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  newTagInput:  {
    flex: 1, backgroundColor: '#fff', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#E0E0E0', fontSize: 14, color: BRAND.navy,
  },
  addBtn:       { backgroundColor: BRAND.blue, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  addBtnText:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  empty:        { textAlign: 'center', color: '#90A4AE', padding: 32 },
});
