import { useId, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { loadGsiScript } from '../lib/loadGsiScript';
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

/** Apple mark (Font Awesome–style path); viewBox matches path coordinates. */
function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 384 512"
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fill="currentColor"
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.1 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.6-.7 44-16.4 81.2-16.4 38.5 0 49.8 16.4 81.2 16.4 48.3-.8 89.1-68.1 101.8-104.8-57.4-26.6-86.7-67.2-86.5-121.1zm-39.9-249.3c21.4-25.9 35.8-61.9 31.8-98-33.5 2.1-74 22.4-98 50-19.8 22.2-37.2 58.2-32.6 97.5 35.1 2.1 71.2-17.9 98.8-49.5z"
      />
    </svg>
  );
}

function shouldIgnoreGoogleUiError(code: string): boolean {
  const c = code.toLowerCase();
  return c.includes('popup') || c.includes('cancel') || c === 'access_denied';
}

export function LoginPage() {
  const { user, login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
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
      if (mode === 'login') await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function onGoogleClick() {
    clearMessages();
    const cid = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!cid) {
      setError(
        'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in your environment (OAuth 2.0 Web client ID).'
      );
      return;
    }

    setGoogleBusy(true);
    try {
      await loadGsiScript();
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Sign-In did not initialize');
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: cid,
        scope: 'openid email profile',
        callback: (tokenResponse) => {
          void (async () => {
            try {
              if (tokenResponse.error) {
                if (!shouldIgnoreGoogleUiError(tokenResponse.error)) {
                  setError(
                    tokenResponse.error_description ?? tokenResponse.error ?? 'Google sign-in failed'
                  );
                }
                return;
              }
              if (!tokenResponse.access_token) return;
              await loginWithGoogle(tokenResponse.access_token);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Google sign-in failed');
            } finally {
              setGoogleBusy(false);
            }
          })();
        },
      });
      client.requestAccessToken({ prompt: '' });
    } catch (err) {
      setGoogleBusy(false);
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in');
    }
  }

  function onApplePlaceholder() {
    clearMessages();
    setInfo('Apple sign-in is not enabled for this deployment yet. Use email and password or Google.');
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
            onClick={() => void onGoogleClick()}
            disabled={googleBusy || busy}
            aria-busy={googleBusy}
          >
            {googleBusy ? (
              <Loader2 className="auth-social-spinner" aria-hidden />
            ) : (
              <GoogleGlyph className="auth-social-icon" />
            )}
            <span>{googleBusy ? 'Connecting…' : 'Continue with Google'}</span>
          </button>
          <button
            type="button"
            className="auth-social-btn auth-social-btn--apple"
            onClick={onApplePlaceholder}
            disabled={busy || googleBusy}
          >
            <AppleGlyph className="auth-social-icon auth-social-icon--apple" />
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
            <span className="auth-label">Email</span>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
                if (info) setInfo(null);
              }}
              autoComplete="email"
              inputMode="email"
              required
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
            disabled={busy || googleBusy}
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
