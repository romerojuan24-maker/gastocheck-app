import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BRAND } from '@gastocheck/shared';
import { logError } from '../lib/logger';
import i18n from '../lib/i18n';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('render_crash', `${error.name}: ${error.message}`, {
      componentStack: info.componentStack?.slice(0, 2000),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (this.state.hasError) {
      const t = i18n.t.bind(i18n);
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{t('validation.renderError')}</Text>
          <Text style={styles.message}>
            {t('validation.renderErrorMsg')}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>{t('validation.retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: BRAND.gray,
    gap: 12,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 18, fontWeight: '700', color: BRAND.navy },
  message: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  button: {
    marginTop: 12,
    backgroundColor: BRAND.navy,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
