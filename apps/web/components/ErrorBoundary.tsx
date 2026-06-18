'use client';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-red-50">
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md">
            <p className="text-4xl mb-4">⚠️</p>
            <h1 className="text-2xl font-bold text-red-700 mb-2">Algo salió mal</h1>
            <p className="text-slate-600 mb-4">{this.state.error?.message || 'Error desconocido'}</p>
            <button onClick={() => window.location.href = '/'} className="w-full py-2 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600">
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
