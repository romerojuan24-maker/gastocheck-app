// Check Advisor — Supervisor Dashboard (Team + Personal Tasks)
// Wave 6: Role-differentiated screen for supervisors/accountants

import { useCallback, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useFocusEffect } from '@react-navigation/native'
import { BRAND } from '@gastocheck/shared'
import { supabase } from '../../../../lib/supabase'
import { getActiveMembership } from '../../../../lib/membership'

const ADVISOR_COLOR = BRAND.navy

const SEVERITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'CRÍTICO', color: '#B71C1C', bg: '#FFEBEE' },
  warning: { label: 'IMPORTANTE', color: '#E65100', bg: '#FFF3E0' },
  info: { label: 'REVISAR', color: '#1565C0', bg: '#E3F2FD' },
}

interface Task {
  id: string
  assigned_to_user_id: string | null
  assigned_to_role: string | null
  task_status: string
  created_at: string
  advisor_insights: {
    title: string
    severity: string
  }
  assigned_user?: { full_name: string }
}

type TabType = 'team' | 'personal'

export default function SupervisorTasksScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [teamTasks, setTeamTasks] = useState<Task[]>([])
  const [personalTasks, setPersonalTasks] = useState<Task[]>([])
  const [activeTab, setActiveTab] = useState<TabType>('team')

  const loadTeamTasks = useCallback(async (cid: string) => {
    try {
      const { data, error } = await supabase
        .from('advisor_tasks')
        .select('*, advisor_insights(title, severity), assigned_user:assigned_to_user_id(full_name)')
        .eq('company_id', cid)
        .in('assigned_to_role', ['operator', 'comprador', 'spender', 'collector'])
        .neq('task_status', 'DISMISSED')
        .order('created_at', { ascending: false })

      if (error) throw error
      setTeamTasks((data ?? []) as Task[])
    } catch (err) {
      console.error('loadTeamTasks failed:', err instanceof Error ? err.message : err)
    }
  }, [])

  const loadPersonalTasks = useCallback(async (cid: string, uid: string) => {
    try {
      const { data, error } = await supabase
        .from('advisor_tasks')
        .select('*, advisor_insights(title, severity)')
        .eq('company_id', cid)
        .eq('assigned_to_user_id', uid)
        .neq('task_status', 'DISMISSED')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPersonalTasks((data ?? []) as Task[])
    } catch (err) {
      console.error('loadPersonalTasks failed:', err instanceof Error ? err.message : err)
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) {
        setLoading(false)
        return
      }

      const member = await getActiveMembership(user.id)
      if (!member) {
        setLoading(false)
        return
      }

      setUserRole(member.role)
      setUserId(user.id)
      setCompanyId(member.company_id)
      await loadTeamTasks(member.company_id)
      await loadPersonalTasks(member.company_id, user.id)
    } catch (err) {
      console.error('load failed:', err instanceof Error ? err.message : err)
    } finally {
      setLoading(false)
    }
  }, [loadTeamTasks, loadPersonalTasks])

  useFocusEffect(useCallback(() => { load() }, [load]))

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BRAND.gray }}>
        <ActivityIndicator size="large" color={ADVISOR_COLOR} />
      </View>
    )
  }

  const displayTasks = activeTab === 'team' ? teamTasks : personalTasks

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.replace('/')} style={s.topBarBack} activeOpacity={0.7}>
          <Text style={s.topBarBackText}>‹ Advisor</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarWordA}>👥 Tareas del Equipo</Text>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={s.tabs}>
        <TouchableOpacity
          onPress={() => setActiveTab('team')}
          style={[s.tab, activeTab === 'team' && s.tabActive]}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'team' && s.tabTextActive]}>
            Equipo ({teamTasks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('personal')}
          style={[s.tab, activeTab === 'personal' && s.tabActive]}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === 'personal' && s.tabTextActive]}>
            Mis Tareas ({personalTasks.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.pad}>
        {displayTasks.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✓</Text>
            <Text style={s.emptyText}>Sin tareas</Text>
            <Text style={s.emptySub}>
              {activeTab === 'team'
                ? 'Tu equipo no tiene tareas pendientes'
                : 'No tienes tareas personales asignadas'}
            </Text>
          </View>
        ) : (
          displayTasks.map(task => {
            const meta = SEVERITY_META[task.advisor_insights.severity] ?? SEVERITY_META.info
            const statusLabel = task.task_status === 'COMPLETED' ? '✓' : task.task_status === 'IN_PROGRESS' ? '⏳' : '○'

            return (
              <TouchableOpacity
                key={task.id}
                onPress={() => router.push(`/advisor/task-detail/${task.id}`)}
                style={s.taskCard}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <View style={[s.severityDot, { backgroundColor: meta.color }]} />
                    <Text style={s.taskTitle}>{task.advisor_insights.title}</Text>
                  </View>

                  {activeTab === 'team' && task.assigned_to_user_id && (
                    <Text style={s.assignedTo}>
                      👤 {task.assigned_user?.full_name || 'Usuario'}
                    </Text>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <Text style={s.status}>{statusLabel} {task.task_status}</Text>
                    <Text style={s.date}>{new Date(task.created_at).toLocaleDateString('es-MX')}</Text>
                  </View>
                </View>

                <Text style={s.arrow}>›</Text>
              </TouchableOpacity>
            )
          })
        )}
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
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEF2F7' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BRAND.navy },
  tabText: { fontSize: 13, fontWeight: '600', color: '#90A4AE' },
  tabTextActive: { color: BRAND.navy, fontWeight: '700' },
  pad: { padding: 16, paddingBottom: 44 },
  empty: { alignItems: 'center', paddingVertical: 50, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  emptyText: { fontSize: 15, fontWeight: '700', color: BRAND.navy },
  emptySub: { fontSize: 12, color: '#90A4AE', marginTop: 6, textAlign: 'center', paddingHorizontal: 30 },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: BRAND.navy },
  assignedTo: { fontSize: 11, color: '#90A4AE', marginTop: 4 },
  status: { fontSize: 11, fontWeight: '600', color: '#607D8B' },
  date: { fontSize: 11, color: '#90A4AE' },
  arrow: { fontSize: 20, color: BRAND.navy, marginLeft: 8 },
})
