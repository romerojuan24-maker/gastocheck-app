import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { BRAND } from '@gastocheck/shared';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseDate(s: string): { y: number; m: number; d: number } {
  const parts = (s || todayStr()).split('-').map(Number);
  const now = new Date();
  return {
    y: parts[0] || now.getFullYear(),
    m: parts[1] || now.getMonth() + 1,
    d: parts[2] || now.getDate(),
  };
}

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const WEEKDAYS = ['LU', 'MA', 'MIE', 'JUE', 'VIE', 'SA', 'DO'];

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay() || 7; // 1=lunes, 7=domingo (ISO)
}

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  style?: object;
}

export default function DatePickerField({ label, value, onChange, style }: Props) {
  const displayValue = value || todayStr();
  const { y, m, d } = parseDate(displayValue);

  const [open, setOpen] = useState(false);
  const [selY, setSelY] = useState(y);
  const [selM, setSelM] = useState(m);
  const [selD, setSelD] = useState(d);

  function openPicker() {
    const { y: py, m: pm, d: pd } = parseDate(displayValue);
    setSelY(py); setSelM(pm); setSelD(pd);
    setOpen(true);
  }

  function confirm() {
    const maxD = daysInMonth(selY, selM);
    const safeD = Math.min(selD, maxD);
    onChange(`${selY}-${String(selM).padStart(2, '0')}-${String(safeD).padStart(2, '0')}`);
    setOpen(false);
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 2 + i);
  const days  = Array.from({ length: daysInMonth(selY, selM) }, (_, i) => i + 1);

  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={openPicker} activeOpacity={0.7}>
        <Text style={styles.fieldText}>{displayValue}</Text>
        <Text style={styles.fieldIcon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Seleccionar fecha</Text>

            <Text style={styles.sectionLabel}>Año</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {years.map((yr) => (
                <TouchableOpacity
                  key={yr}
                  style={[styles.chip, selY === yr && styles.chipActive]}
                  onPress={() => setSelY(yr)}>
                  <Text style={[styles.chipText, selY === yr && styles.chipTextActive]}>{yr}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Mes</Text>
            <View style={styles.chipWrap}>
              {MONTHS.map((mn, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.chip, selM === i + 1 && styles.chipActive]}
                  onPress={() => setSelM(i + 1)}>
                  <Text style={[styles.chipText, selM === i + 1 && styles.chipTextActive]}>{mn}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Día</Text>

            {/* Headers de días de la semana */}
            <View style={styles.weekdayHeaderRow}>
              {WEEKDAYS.map((wd) => (
                <View key={wd} style={styles.weekdayHeaderCell}>
                  <Text style={styles.weekdayHeaderText}>{wd}</Text>
                </View>
              ))}
            </View>

            {/* Grilla de días.
                IMPORTANTE: sin `gap` en el contenedor — con celdas de 14.285%
                el gap hacía que solo cupieran 6 columnas por fila y TODO el
                calendario quedaba corrido un día respecto al encabezado
                (ej. martes 21 aparecía bajo VIE). El espaciado va DENTRO
                de cada celda (padding del wrapper). */}
            <View style={styles.calendarGrid}>
              {/* Espacios en blanco para días antes del primero del mes */}
              {Array.from({ length: firstDayOfMonth(selY, selM) - 1 }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellWrap} />
              ))}

              {/* Días del mes */}
              {days.map((day) => (
                <View key={day} style={styles.dayCellWrap}>
                  <TouchableOpacity
                    style={[styles.dayChip, selD === day && styles.dayChipActive]}
                    onPress={() => setSelD(day)}>
                    <Text style={[styles.dayChipText, selD === day && styles.dayChipTextActive]}>
                      {String(day).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setOpen(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirm}>
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:          { marginBottom: 4 },
  label:            {
    fontSize: 12, fontWeight: '700', color: '#90A4AE',
    textTransform: 'uppercase', marginBottom: 6, marginTop: 12,
  },
  field:            {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 13,
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  fieldText:        { fontSize: 15, color: BRAND.navy, fontWeight: '600' },
  fieldIcon:        { fontSize: 18 },
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet:            {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 40,
  },
  sheetTitle:       { fontSize: 17, fontWeight: '800', color: BRAND.navy, textAlign: 'center', marginBottom: 8 },
  sectionLabel:     {
    fontSize: 11, fontWeight: '700', color: '#90A4AE',
    textTransform: 'uppercase', marginBottom: 8, marginTop: 14,
  },
  chipRow:          { gap: 8, paddingBottom: 2 },
  chipWrap:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  chipActive:       { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  chipText:         { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  chipTextActive:   { color: '#fff' },

  // Calendario grilla — 7 columnas EXACTAS: nada de gap en los contenedores
  weekdayHeaderRow: { flexDirection: 'row', marginBottom: 8, marginTop: 2 },
  weekdayHeaderCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 6 },
  weekdayHeaderText: { fontSize: 11, fontWeight: '800', color: '#90A4AE', textTransform: 'uppercase' },

  calendarGrid:     { flexDirection: 'row', flexWrap: 'wrap' },
  dayCellWrap:      { width: '14.2857%', padding: 2 },
  dayChip:          {
    aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center',
    borderRadius: 8, backgroundColor: '#F5F5F5',
    borderWidth: 1, borderColor: '#E0E0E0',
  },
  dayChipActive:    { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  dayChipText:      { fontSize: 13, color: BRAND.navy, fontWeight: '600' },
  dayChipTextActive:{ color: '#fff' },
  sheetActions:     { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:        { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText:    { fontSize: 15, fontWeight: '700', color: '#90A4AE' },
  confirmBtn:       { flex: 2, backgroundColor: BRAND.blue, borderRadius: 12, padding: 14, alignItems: 'center' },
  confirmBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});
