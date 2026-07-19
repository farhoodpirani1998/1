import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// There was no error boundary anywhere in the app before this — a single
// throwing component (bad data shape, undefined property access, etc.)
// unmounts the entire React tree with zero fallback, which is exactly why
// a broken page shows up as a totally blank white screen instead of any
// kind of message. This catches that and shows the real error instead.
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Render error caught by AppErrorBoundary:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div dir="rtl" style={{ padding: 24, fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto' }}>
          <h1 style={{ color: '#C0392B', fontSize: 18, marginBottom: 8 }}>یه خطا توی این صفحه پیش اومد</h1>
          <p style={{ color: '#333', marginBottom: 16 }}>
            متن پایین رو کپی کن و بفرست — دقیقاً همین ارور علت سفید شدن صفحه‌ست.
          </p>
          <pre
            style={{
              direction: 'ltr',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f4f4f4',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
              fontSize: 12,
              color: '#111',
            }}
          >
            {error.name}: {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => window.location.assign('/')}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#1D3766',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            بازگشت به خانه
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Wraps <Routes> in App.tsx. Keying by pathname makes the boundary reset
// automatically the moment the user navigates to a different route, so a
// crash on /reports doesn't keep showing the error screen after they go
// to /students.
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <AppErrorBoundary key={location.pathname}>{children}</AppErrorBoundary>;
}
