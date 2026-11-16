import { ShieldOff } from 'lucide-react';
import { Button } from '../../components/ui';
import Frame from './Frame.jsx';

/** @param {{ email: string, signOut: () => Promise<void> }} props */
export default function NotAuthorised({ email, signOut }) {
  return (
    <Frame narrow>
      <main className="dj-panel">
        <ShieldOff className="dj-panel__icon" size={36} aria-hidden="true" />
        <h1 className="dj-panel__title">Not authorised</h1>
        <p>
          {email ? <strong>{email}</strong> : 'This account'} is signed in but isn&apos;t set up to use the DJ dashboard.
        </p>
        <p className="dj-muted">If this should work, ask the site owner to add this account as an admin.</p>
        <Button variant="secondary" className="dj-wide" onClick={() => signOut()}>
          Sign out
        </Button>
      </main>
    </Frame>
  );
}
