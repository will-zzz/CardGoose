import { useId, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../contexts/useAuth';

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M16.365 1.43c0 1.14-.493 2.396-1.182 3.114-.709.758-1.942 1.344-2.978 1.15-.23-1.09.484-2.284 1.165-2.982.742-.767 2.078-1.323 2.995-1.282zm4.635 16.577c-.353.823-.755 1.605-1.218 2.357-1.656 2.54-2.46 3.616-4.09 5.814-1.596 2.15-3.774 4.831-6.506 4.85-1.225.01-1.963-.322-2.75-.658-1.004-.42-1.928-.81-3.008-.785-1.137.026-2.04.43-3.044.852-.787.336-1.51.764-2.735.675-2.705-.19-4.69-2.504-6.286-4.654-3.42-4.61-3.803-10.01-1.684-12.87 1.63-2.19 4.218-3.468 6.646-3.468 1.24 0 2.396.418 3.4.794.86.31 1.648.593 2.385.593.79 0 1.618-.29 2.536-.615.903-.32 1.9-.672 3.037-.637 1.054.03 2.02.29 2.89.672-1.006 1.227-1.59 2.79-1.59 4.4 0 3.26 2.65 5.92 5.92 5.92.35 0 .69-.03 1.03-.08-.66 1.95-1.24 3.9-1.97 5.83z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const infoId = useId();

  if (user) {
    return <Navigate to="/" replace />;
  }

  function clearMessages() {
    setError(null);
    setInfo(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  function onSocialPlaceholder(provider: 'google' | 'apple') {
    clearMessages();
    setInfo(
      provider === 'google'
        ? 'Google sign-in is not enabled for this deployment yet. Use email and password below.'
        : 'Apple sign-in is not enabled for this deployment yet. Use email and password below.'
    );
  }

  const heading = mode === 'login' ? 'Welcome back' : 'Create your account';
  const sub =
    mode === 'login'
      ? 'Sign in to CardGoose to continue to your workspace.'
      : 'Set up your credentials to start using CardGoose.';

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <header className="auth-card-header">
          <div className="auth-card-brand">
            <BrandLogo heightPx={48} alt="CardGoose" />
          </div>
          <h1 className="auth-card-title">{heading}</h1>
          <p className="auth-card-sub">{sub}</p>
        </header>

        <div className="auth-social">
          <button
            type="button"
            className="auth-social-btn auth-social-btn--google"
            onClick={() => onSocialPlaceholder('google')}
          >
            <GoogleGlyph className="auth-social-icon" />
            <span>Continue with Google</span>
          </button>
          <button
            type="button"
            className="auth-social-btn auth-social-btn--apple"
            onClick={() => onSocialPlaceholder('apple')}
          >
            <AppleGlyph className="auth-social-icon" />
            <span>Continue with Apple</span>
          </button>
        </div>

        <div className="auth-divider" role="separator">
          <span className="auth-divider-line" aria-hidden />
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line" aria-hidden />
        </div>

        <form
          className="auth-form"
          onSubmit={onSubmit}
          aria-busy={busy}
          noValidate
        >
          {info && (
            <p id={infoId} className="auth-banner auth-banner--info" role="status">
              {info}
            </p>
          )}
          {error && (
            <p id={errorId} className="auth-banner auth-banner--error" role="alert">
              {error}
            </p>
          )}

          <label className="auth-field">
            <span className="auth-label">Email or username</span>
            <input
              className="auth-input"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
                if (info) setInfo(null);
              }}
              autoComplete="username"
              required
              minLength={2}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : info ? infoId : undefined}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label-row">
              <span className="auth-label">Password</span>
              {mode === 'login' && (
                <button
                  type="button"
                  className="auth-inline-link"
                  onClick={() => {
                    clearMessages();
                    setInfo('Password reset is not available in this environment yet.');
                  }}
                >
                  Forgot password?
                </button>
              )}
            </span>
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
                if (info) setInfo(null);
              }}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>

          <button
            type="submit"
            className="auth-primary"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <Loader2 className="auth-primary-spinner" aria-hidden />
                <span>{mode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
              </>
            ) : mode === 'login' ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </button>
        </form>

        <p className="auth-footer">
          {mode === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={() => {
                  setMode('register');
                  clearMessages();
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="auth-footer-link"
                onClick={() => {
                  setMode('login');
                  clearMessages();
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
