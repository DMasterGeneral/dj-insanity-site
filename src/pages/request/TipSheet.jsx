import { useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  CheckoutElementsProvider,
  ContactDetailsElement,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from '@stripe/react-stripe-js/checkout';
import Dialog from '../../components/ui/Dialog.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatTip } from './requestLogic.js';

// The tip payment sheet (plan section 4.2): Stripe Checkout Sessions with ui_mode=elements.
// Loaded with React.lazy only when a guest submits a request with a tip, so Stripe.js and
// react-stripe-js never reach the landing page or the first load of /request.
// Wallet buttons (Apple Pay, Google Pay, Link) sit above the email + card form. A successful
// confirm without a redirect calls onPaid; redirect-based methods come back to the session's
// return_url, the same /request/thanks?rid=… page. If confirm throws (e.g. the connection drops)
// the payment may or may not have gone through, so onUnsure sends the guest to that page to find
// out instead of offering a retry that could pay twice.

/** @type {ReturnType<typeof loadStripe> | null} */
let stripePromise = null;
function getStripe() {
  stripePromise ??= loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY).catch((err) => {
    stripePromise = null; // let the next open try again
    throw err;
  });
  return stripePromise;
}

// Elements render in Stripe's iframes, so they get the page's colours here, not from CSS.
// The page font (Inter, self-hosted) is not available inside those iframes; system UI fonts are close.
/** @type {import('@stripe/stripe-js').Appearance} */
const APPEARANCE = {
  theme: 'night',
  variables: {
    colorPrimary: '#2563eb',
    colorBackground: '#1a1a24',
    colorText: '#f8f8fa',
    colorTextSecondary: '#b4b4c2',
    colorDanger: '#ff7a7a',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    fontSizeBase: '16px',
    borderRadius: '12px',
  },
  rules: {
    '.Input': { border: '1px solid #3a3a48' },
    '.Tab': { border: '1px solid #3a3a48' },
  },
};

/**
 * @param {{ busy: boolean, setBusy: (b: boolean) => void, onPaid: () => void, onUnsure: () => void }} props
 */
function TipForm({ busy, setBusy, onPaid, onUnsure }) {
  const state = useCheckoutElements();
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [hasWallets, setHasWallets] = useState(false);

  if (state.type === 'loading') {
    return (
      <p className="rq-loading" role="status">
        <span className="rq-spinner" aria-hidden="true" />
        Loading payment…
      </p>
    );
  }
  if (state.type === 'error' || state.checkout.status.type === 'expired') {
    return (
      <div className="rq-notice rq-notice--error" role="alert">
        <p>
          {state.type === 'error'
            ? "The payment form didn't load. Check your connection, close this and try again."
            : 'This payment timed out. Close this and send your request again.'}
        </p>
      </div>
    );
  }
  const { checkout } = state;

  /** @param {Parameters<typeof checkout.confirm>[0]} [opts] */
  async function pay(opts) {
    setError(null);
    setBusy(true);
    try {
      const result = await checkout.confirm({ redirect: 'if_required', ...opts });
      if (result.type === 'success') {
        onPaid();
        return;
      }
      setError(result.error.message);
    } catch {
      onUnsure();
      return;
    }
    setBusy(false);
  }

  return (
    <form
      className="rq-sheet__form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) pay();
      }}
    >
      <ExpressCheckoutElement
        onConfirm={(event) => pay({ expressCheckoutConfirmEvent: event })}
        onReady={({ availablePaymentMethods }) => setHasWallets(!!availablePaymentMethods)}
      />
      {hasWallets && <p className="rq-sheet__or">or pay by card</p>}
      <ContactDetailsElement />
      <PaymentElement />
      {error && (
        <p className="rq-notice rq-notice--error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="rq-button-lg rq-button-block" disabled={busy || !checkout.canConfirm}>
        {busy ? 'Paying…' : `Pay ${checkout.total.total.amount}`}
      </Button>
      <p className="rq-sheet__fine">Your request goes to the DJ as soon as the payment goes through.</p>
    </form>
  );
}

/**
 * @param {{ clientSecret: string, tipCents: number, onClose: () => void, onPaid: () => void, onUnsure: () => void }} props
 */
export default function TipSheet({ clientSecret, tipCents, onClose, onPaid, onUnsure }) {
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => ({ clientSecret, elementsOptions: { appearance: APPEARANCE } }), [clientSecret]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Tip ${formatTip(tipCents)} with your request`}
      className="rq-sheet"
      closeLabel="Close payment"
      dismissible={!busy}
    >
      <CheckoutElementsProvider stripe={getStripe()} options={options}>
        <TipForm busy={busy} setBusy={setBusy} onPaid={onPaid} onUnsure={onUnsure} />
      </CheckoutElementsProvider>
    </Dialog>
  );
}
