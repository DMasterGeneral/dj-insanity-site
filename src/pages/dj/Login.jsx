import { useState } from 'react';
import { Disc } from 'lucide-react';
import { Button, Field } from '../../components/ui';
import Frame from './Frame.jsx';

const MESSAGES = {
  'auth/invalid-credential': "That email and password don't match. Check them and try again.",
  'auth/invalid-login-credentials': "That email and password don't match. Check them and try again.",
  'auth/wrong-password': "That email and password don't match. Check them and try again.",
  'auth/user-not-found': "That email and password don't match. Check them and try again.",
  'auth/invalid-email': "That doesn't look like an email address.",
  'auth/missing-password': 'Enter your password.',
  'auth/user-disabled': 'This account has been turned off. Ask the site owner to turn it back on.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes, then try again.',
  'auth/network-request-failed': "Can't reach the sign-in server. Check your connection and try again.",
};

/** @param {{ signIn: (email: string, password: string) => Promise<void> }} props */
export default function Login({ signIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(MESSAGES[err?.code] || "Sign-in didn't work. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <Frame narrow>
      <main className="dj-panel">
        <Disc className="dj-panel__icon" size={36} aria-hidden="true" />
        <h1 className="dj-panel__title">DJ dashboard</h1>
        <p className="dj-muted">Sign in to see requests and bookings.</p>
        <form className="dj-form" onSubmit={onSubmit} noValidate>
          <Field
            id="dj-email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            id="dj-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="dj-error" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="dj-wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </main>
    </Frame>
  );
}
