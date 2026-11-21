// Tip payments: the request document is the state machine.
//   awaiting_payment + tip.state 'pending'  --paid-->     status 'pending' + tip.state 'paid' (reaches the DJ)
//                                           --failed-->   tip.state 'failed' (status stays awaiting_payment)
// Only a doc whose tip is still 'pending' changes, so a replayed event, an "expired" after "paid", or
// an event after the DJ marked the request played changes nothing. Every write carries the
// updateTime of the read it was based on, so two settles racing cannot both apply.
import { FirestoreError, serverTimestamp } from './firestore.js';

export const ID_RE = /^[A-Za-z0-9_-]{20,40}$/;

const TRIES = 2;

/** @param {unknown} err */
const isConflict = (err) => err instanceof FirestoreError && (err.grpcStatus === 'FAILED_PRECONDITION' || err.grpcStatus === 'ABORTED');

/**
 * @typedef {{ result: 'paid'|'failed'|'unchanged', status: string, tipState: string } | { result: 'missing' }} SettleResult
 */

/**
 * Apply a Checkout Session's outcome to requests/{rid}.
 * Paid when payment_status is 'paid'; failed when the session expired or `paymentFailed` is set
 * (checkout.session.async_payment_failed). A write conflict is re-read and re-evaluated once; a
 * second conflict, like any Firestore error, is thrown.
 * @param {import('./firestore.js').FirestoreClient} fs
 * @param {string} rid
 * @param {{ id?: string, status?: string, payment_status?: string, amount_total?: number }} session
 * @param {{ paymentFailed?: boolean }} [opts]
 * @returns {Promise<SettleResult>}
 */
export async function settle(fs, rid, session, { paymentFailed = false } = {}) {
  const path = `requests/${rid}`;
  for (let attempt = 1; ; attempt++) {
    const doc = await fs.getWithTime(path);
    if (!doc) return { result: 'missing' };
    const tip = /** @type {Record<string, unknown>} */ (doc.data.tip || {});
    const status = typeof doc.data.status === 'string' ? doc.data.status : 'pending';
    const current = { status, tipState: typeof tip.state === 'string' ? tip.state : 'none' };

    const ours = tip.checkoutSessionId === session.id;
    let next = null;
    if (ours && tip.state === 'pending') {
      if (session.payment_status === 'paid') next = 'paid';
      else if (session.status === 'expired' || paymentFailed) next = 'failed';
    }
    if (!next) return { result: 'unchanged', ...current };

    try {
      if (next === 'paid') {
        const amountCents = Number.isInteger(session.amount_total) ? session.amount_total : tip.amountCents;
        await fs.patch(
          path,
          { status: 'pending', tip: { state: 'paid', amountCents }, paidAt: serverTimestamp, updatedAt: serverTimestamp },
          ['status', 'tip.state', 'tip.amountCents', 'paidAt', 'updatedAt'],
          { updateTime: doc.updateTime },
        );
        return { result: 'paid', status: 'pending', tipState: 'paid' };
      }
      await fs.patch(path, { tip: { state: 'failed' }, updatedAt: serverTimestamp }, ['tip.state', 'updatedAt'], {
        updateTime: doc.updateTime,
      });
      return { result: 'failed', status, tipState: 'failed' };
    } catch (err) {
      if (!isConflict(err) || attempt >= TRIES) throw err;
    }
  }
}
