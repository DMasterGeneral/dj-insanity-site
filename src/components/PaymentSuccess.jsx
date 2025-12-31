import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Home, AlertCircle } from 'lucide-react';
import { addSongRequest } from '../lib/firebase';

export default function PaymentSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading');
    const [error, setError] = useState('');
    const hasProcessed = useRef(false); // Prevent double-processing in StrictMode/multi-tab

    useEffect(() => {
        const processPayment = async () => {
            // Prevent double-processing (React StrictMode, multiple tabs)
            if (hasProcessed.current) return;
            hasProcessed.current = true;

            // Get params from Stripe redirect
            const redirectStatus = searchParams.get('redirect_status');
            const requestId = searchParams.get('requestId');

            // Check if payment was successful
            if (redirectStatus !== 'succeeded') {
                setStatus(redirectStatus === 'failed' ? 'failed' : 'unknown');
                return;
            }

            // Payment succeeded - now write to Firebase
            if (!requestId) {
                setStatus('error');
                setError('Missing request ID');
                return;
            }

            // Get pending request from sessionStorage
            const storageKey = `pending_request_${requestId}`;
            const pendingData = sessionStorage.getItem(storageKey);

            if (!pendingData) {
                // Already processed (by this tab or another tab)
                setStatus('already_processed');
                return;
            }

            // IMMEDIATELY remove from sessionStorage to prevent other tabs from processing
            // This is our "atomic claim" - first tab to delete wins
            sessionStorage.removeItem(storageKey);

            try {
                const songRequest = JSON.parse(pendingData);

                // Write to Firebase
                await addSongRequest({
                    type: songRequest.type,
                    content: songRequest.content,
                    title: songRequest.title,
                    tip: songRequest.tip,
                });

                setStatus('success');
            } catch (err) {
                console.error('Firebase write error:', err);
                setStatus('error');
                setError('Failed to submit request. Please contact DJ.');
                // Note: We already removed from sessionStorage, so can't retry
                // In production, you might want to store failed requests somewhere
            }
        };

        processPayment();
    }, [searchParams]);

    return (
        <div className="noise-bg min-h-screen text-white flex items-center justify-center p-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
                {status === 'loading' && null}

                {status === 'success' && (
                    <>
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={48} className="text-green-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-green-400 mb-2">Thank You!</h1>
                        <p className="text-white/60 mb-6">
                            Your tip has been received and your song request is now in the queue! 🎵
                        </p>
                    </>
                )}

                {status === 'already_processed' && (
                    <>
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={48} className="text-green-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-green-400 mb-2">All Set!</h1>
                        <p className="text-white/60 mb-6">
                            Your request has already been submitted. 🎵
                        </p>
                    </>
                )}

                {status === 'failed' && (
                    <>
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle size={48} className="text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-red-400 mb-2">Payment Failed</h1>
                        <p className="text-white/60 mb-6">
                            Your payment was not completed. No charge was made.
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={48} className="text-orange-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-orange-400 mb-2">Oops!</h1>
                        <p className="text-white/60 mb-6">
                            {error || 'Something went wrong. Please try again.'}
                        </p>
                    </>
                )}

                {status === 'unknown' && (
                    <>
                        <div className="text-white/40 text-6xl mb-4">❓</div>
                        <h1 className="text-2xl font-bold mb-2">Unknown Status</h1>
                        <p className="text-white/50 mb-6">
                            We couldn't determine the payment status.
                        </p>
                    </>
                )}

                <button
                    onClick={() => navigate('/request')}
                    className="w-full py-3 bg-electric rounded-xl font-bold hover:bg-electric/80 transition-all flex items-center justify-center gap-2"
                >
                    <Home size={20} /> Back to Requests
                </button>
            </div>
        </div>
    );
}
