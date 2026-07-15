// Check Advisor — Task Detail Screen
// Shows full insight + task actions + supervisor controls

import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { BRAND } from '@gastocheck/shared'
import { supabase } from '../../../lib/supabase'
import { getActiveMembership } from '../../../lib/membership'

const ADVISOR_COLOR = BRAND.navy

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRÍTICO', color: '#B71C1C', bg: '#FFEBEE' },
  warning: { label: 'IMPORTANTE', color: '#E65100', bg: '#FFF3E0' },
  info: { label: 'REVISAR', color: '#1565C0', bg: '#E3F2FD' },
}

interface TaskDetail {
  id: string
  task_status: string
  task_priority: number
  due_date: string | null
  notes: string | null
  assigned_to_user_id: string | null
  created_at: string
  advisor_insights: {
    title: string
    body: string
    severity: string
    priority_score: number
    explanation: string | null
    generated_by: string
    evidence_json: any
  }
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<TaskDetail | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [expandEvidence, setExpandEvidence] = useState(false)
  const [newNote, setNewNote] = useState('')

  const loadTask = useCallback(async () => {
    if (!id) return
    try {
      const { data, error } = await supabase
        .from('advisor_tasks')
        .select('*, advisor_insights(title, body, severity, priority_score, explanation, generated_by, evidence_json)')
        .eq('id', id as string)
        .single()

      if (error) throw error
      setTask(data as TaskDetail)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo cargar la tarea')
      router.back()
    }
  }, [id, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (user) {
        const member = await getActiveMembership(user.id)
        if (member) setUserRole(member.role)
      }
      await loadTask()
    } catch (err) {
      console.error('load failed:', err instanceof Error ? err.message : err)
    } finally {
      setLoading(false)
    }
  }, [loadTask])

  useFocusEffect(useCallback(() => { load() }, [load]))

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .rpc('update_task_status', {
          p_task_id: task.id,
          p_new_status: newStatus,
          p_notes: newNote || null,
        })

      if (error) throw error
      await loadTask()
      setNewNote('')
      Alert.alert('Éxito', `Tarea marcada como ${newStatus}`)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar')
    } finally {
      setUpdating(false)
    }
  }

  if (loading || !task) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={ADVISOR_COLOR} />
      </View>
    )
  }

  const insight = task.advisor_insights
  const meta = SEVERITY_META[insight.severity] ?? SEVERITY_META.info
  const isSupervisor = userRole ? ['owner', 'admin', 'supervisor', 'accountant', 'contador_general'].includes(userRole) : false

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ Atrás</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>📋 Detalle</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.pad}>
        {/* Severity Badge */}
        <View style={[s.severityPill, { backgroundColor: meta.bg }]}>
          <Text style={[s.severityText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {/* Title */}
        <Text style={s.title}>{insight.title}</Text>

        {/* Body / Explanation */}
        <Text style={s.body}>{insight.explanation || insight.body}</Text>

        {insight.generated_by === 'HYBRID' && (
          <Text style={s.aiTag}>✨ Redactado por IA a partir de datos verificados</Text>
        )}

        {/* Evidence */}
        {insight.evidence_json && Object.keys(insight.evidence_json).length > 0 && (
          <View style={s.evidenceSection}>
            <TouchableOpacity
              onPress={() => setExpandEvidence(!expandEvidence)}
              style={s.evidenceHeader}
              activeOpacity={0.7}
            >
              <Text style={s.evidenceTitle}>{expandEvidence ? '▼' : '▶'} Datos que respaldan esto</Text>
            </TouchableOpacity>

            {expandEvidence && (
              <View style={s.evidenceBox}>
                {Object.entries(insight.evidence_json).map(([k, v]) => (
                  v !== null && (
                    <View key={k} style={s.evidenceLine}>
                      <Text style={s.evidenceKey}>{k}:</Text>
                      <Text style={s.evidenceValue}>
                        {typeof v === 'number' ? v.toLocaleString('es-MX') : String(v)}
                      </Text>
                    </View>
                  )
                ))}
              </View>
            )}
          </View>
        )}

        {/* Task Status */}
        <View style={s.taskSection}>
          <Text style={s.sectionTitle}>Estado de la Tarea</Text>
          <View style={s.statusRow}>
            <Text style={s.label}>Estado:</Text>
            <Text style={s.value}>{task.task_status}</Text>
          </View>

          {task.due_date && (
            <View style={s.statusRow}>
              <Text style={s.label}>Vencimiento:</Text>
              <Text style={s.value}>{new Date(task.due_date).toLocaleDateString('es-MX')}</Text>
            </View>
          )}

          {task.notes && (
            <View style={[s.statusRow, { alignItems: 'flex-start' }]}>
              <Text style={s.label}>Notas:</Text>
              <Text style={[s.value, { flex: 1 }]}>{task.notes}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={s.actionsSection}>
          <Text style={s.sectionTitle}>Acciones</Text>

          {task.task_status !== 'COMPLETED' && (
            <TouchableOpacity
              onPress={() => handleStatusChange('COMPLETED')}
              disabled={updating}
              style={s.actionBtn}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.actionBtnText}>✓ Marcar Completada</Text>
              )}
            </TouchableOpacity>
          )}

          {task.task_status === 'COMPLETED' && (
            <TouchableOpacity
              onPress={() => handleStatusChange('PENDING')}
              disabled={updating}
              style={[s.actionBtn, s.actionBtnSecondary]}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator size="small" color={BRAND.navy} />
              ) : (
                <Text style={[s.actionBtnText, s.actionBtnSecondaryText]}>↩ Reabrir Tarea</Text>
              )}
            </TouchableOpacity>
          )}

          {task.task_status !== 'IN_PROGRESS' && (
            <TouchableOpacity
              onPress={() => handleStatusChange('IN_PROGRESS')}
              disabled={updating}
              style={[s.actionBtn, s.actionBtnInfo]}
              activeOpacity={0.7}
            >
              {updating ? (
                <ActivityIndicator size="small" color={BRAND.blue} />
              ) : (
                <Text style={[s.actionBtnText, s.actionBtnInfoText]}>⏳ En Progreso</Text>
              )}
            </TouchableOpacity>
          )}

          {isSupervisor && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 16 }]}>Supervisor Actions</Text>
              <View style={s.noteInput}>
                <TextInput
                  placeholder="Agregar nota..."
                  value={newNote}
                  onChangeText={setNewNote}
                  style={s.noteInputField}
                  placeholderTextColor="#90A4AE"
                  multiline
                  maxLength={200}
                />
                <Text style={s.charCount}>{newNote.length}/200</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const TOP_INSET = Platform.OS === 'ios' ? 54 : 32

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BRAND.gray },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: TOP_INSET,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF2F7',
  },
  topBarBack: { paddingRight: 12 },
  topBarBackText: { fontSize: 13, fontWeight: '700', color: BRAND.csblue },
  topBarCenter: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  topBarWordA: { fontSize: 19, fontWeight: '800', color: BRAND.navy },
  pad: { padding: 20, paddingBottom: 44 },
  severityPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  severityText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: '800', color: BRAND.navy, marginBottom: 12 },
  body: { fontSize: 14, color: '#455A64', lineHeight: 22, marginBottom: 12 },
  aiTag: { fontSize: 11, color: '#90A4AE', fontStyle: 'italic', marginBottom: 16 },
  evidenceSection: { marginVertical: 16 },
  evidenceHeader: { paddingVertical: 8 },
  evidenceTitle: { fontSize: 13, fontWeight: '700', color: BRAND.navy },
  evidenceBox: { backgroundColor: '#F8F9FB', borderRadius: 10, padding: 12, marginTop: 8 },
  evidenceLine: { flexDirection: 'row', marginBottom: 6, gap: 8 },
  evidenceKey: { fontSize: 12, color: '#607D8B', fontWeight: '600', flex: 0.4 },
  evidenceValue: { fontSize: 12, color: '#455A64', flex: 0.6 },
  taskSection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: BRAND.navy, marginBottom: 12 },
  statusRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'center' },
  label: { fontSize: 12, color: '#90A4AE', fontWeight: '600', flex: 0.35 },
  value: { fontSize: 13, color: BRAND.navy, fontWeight: '600', flex: 0.65 },
  actionsSection: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20 },
  actionBtn: { backgroundColor: BRAND.navy, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  actionBtnSecondary: { backgroundColor: '#F5F5F5' },
  actionBtnInfo: { backgroundColor: '#E3F2FD' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actionBtnSecondaryText: { color: BRAND.navy },
  actionBtnInfoText: { color: BRAND.blue },
  noteInput: { backgroundColor: '#F5F5F5', borderRadius: 10, padding: 12, marginTop: 8 },
  noteInputField: { fontSize: 13, color: BRAND.navy, minHeight: 60, padding: 8 },
  charCount: { fontSize: 11, color: '#90A4AE', textAlign: 'right', marginTop: 4 },
})
