import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { BRAND } from '@gastocheck/shared';

export function TransactionDetailModal({ transaction, visible, onClose, onClassify, onMatch }) {
  const [showClassify, setShowClassify] = useState(false);
  const [showMatch, setShowMatch] = useState(false);
  const [classifyForm, setClassifyForm] = useState({
    status: transaction?.status || '',
    category: transaction?.category || '',
    notes: transaction?.notes || '',
  });
  const [matchForm, setMatchForm] = useState({
    entityType: transaction?.matchedEntityType || '',
    entityId: transaction?.matchedEntityId || '',
  });

  const handleClassify = () => {
    onClassify(classifyForm);
    setShowClassify(false);
  };

  const handleMatch = () => {
    onMatch(matchForm);
    setShowMatch(false);
  };

  if (!transaction) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Movimiento</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Descripción</Text>
          <Text style={styles.value}>{transaction.description}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Fecha</Text>
          <Text style={styles.value}>{new Date(transaction.date).toLocaleDateString('es-MX')}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Monto</Text>
          <Text style={[styles.value, { color: transaction.credit > 0 ? '#10b981' : '#ef4444', fontSize: 20, fontWeight: 'bold' }]}>
            ${Math.max(parseFloat(transaction.debit), parseFloat(transaction.credit)).toFixed(2)}
          </Text>

          <Text style={[styles.label, { marginTop: 12 }]}>Estado</Text>
          <Text style={[styles.statusBadge, { backgroundColor: BRAND.PRIMARY }]}>
            {transaction.status}
          </Text>
        </View>

        <View style={styles.buttonGrid}>
          <TouchableOpacity style={[styles.button, { backgroundColor: BRAND.PRIMARY }]} onPress={() => setShowClassify(true)}>
            <Text style={styles.buttonText}>📝 Clasificar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={() => setShowMatch(true)}>
            <Text style={styles.buttonText}>🔗 Relacionar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Classify Modal */}
      <Modal visible={showClassify} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Clasificar</Text>
            <TextInput
              style={styles.input}
              placeholder="Status (EXPLAINED, NEEDS_INVOICE)"
              value={classifyForm.status}
              onChangeText={(text) => setClassifyForm({ ...classifyForm, status: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Categoría"
              value={classifyForm.category}
              onChangeText={(text) => setClassifyForm({ ...classifyForm, category: text })}
            />
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Notas"
              value={classifyForm.notes}
              onChangeText={(text) => setClassifyForm({ ...classifyForm, notes: text })}
              multiline
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: BRAND.PRIMARY }]} onPress={handleClassify}>
              <Text style={styles.buttonText}>Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#999' }]} onPress={() => setShowClassify(false)}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Match Modal */}
      <Modal visible={showMatch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Relacionar</Text>
            <TextInput
              style={styles.input}
              placeholder="Tipo (invoice, expense, collection)"
              value={matchForm.entityType}
              onChangeText={(text) => setMatchForm({ ...matchForm, entityType: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="ID de entidad"
              value={matchForm.entityId}
              onChangeText={(text) => setMatchForm({ ...matchForm, entityId: text })}
            />
            <TouchableOpacity style={[styles.button, { backgroundColor: '#10b981' }]} onPress={handleMatch}>
              <Text style={styles.buttonText}>Relacionar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#999' }]} onPress={() => setShowMatch(false)}>
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { fontSize: 24, color: '#999' },
  card: { backgroundColor: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 16 },
  label: { fontSize: 12, color: '#666', fontWeight: '500' },
  value: { fontSize: 16, fontWeight: '500', marginTop: 4 },
  statusBadge: { color: '#fff', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, marginTop: 4, fontSize: 12, fontWeight: '500', alignSelf: 'flex-start' },
  buttonGrid: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6, marginBottom: 12 },
});
