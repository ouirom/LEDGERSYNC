import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f0f2f8)', padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <AlertTriangle size={40} color="#e94560" style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Une erreur inattendue est survenue</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>
              L'application a rencontré un problème et n'a pas pu continuer. Vos données n'ont pas été perdues.
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              style={{ padding: '10px 20px', background: '#0f3460', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
