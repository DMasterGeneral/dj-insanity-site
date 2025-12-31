import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { DollarSign, X } from 'lucide-react';

// Initialize Stripe with publishable key from env
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Payment form component (inside Elements provider)
function CheckoutForm({ amount, requestId, onClose }) {
    const stripe = useStripe();
    const elements = useElements();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);
        setMessage('');

        // Include requestId in return URL so PaymentSuccess can find the pending request
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/payment-success?requestId=${requestId}`,
            },
        });

        if (error) {
            setMessage(error.message || 'An unexpected error occurred.');
            setIsLoading(false);
        }
        // If successful, user is redirected to return_url
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement
                options={{
                    layout: 'tabs',
                }}
            />
            <button
                type="submit"
                disabled={isLoading || !stripe || !elements}
                className="w-full py-4 bg-gradient-to-r from-gold to-yellow-500 text-black rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
                {isLoading ? 'Processing...' : `Send $${amount} Tip`}
            </button>
            {message && (
                <div className="text-red-400 text-sm text-center">{message}</div>
            )}
        </form>
    );
}

// Main Tip Modal Component
export default function TipDJ({ isOpen, onClose, amount, requestId }) {
    const [clientSecret, setClientSecret] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch PaymentIntent when modal opens
    useEffect(() => {
        if (!isOpen || !amount || !requestId) return;

        const fetchPaymentIntent = async () => {
            setLoading(true);
            setError('');
            setClientSecret('');

            try {
                const workerUrl = import.meta.env.VITE_STRIPE_WORKER_URL;
                if (!workerUrl) {
                    throw new Error('Stripe worker URL not configured');
                }

                const response = await fetch(workerUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ amount }),
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                setClientSecret(data.clientSecret);
            } catch (err) {
                console.error('Error creating payment intent:', err);
                setError(err.message || 'Failed to initialize payment');
            }
            setLoading(false);
        };

        fetchPaymentIntent();
    }, [amount, isOpen, requestId]);

    if (!isOpen) return null;

    // Stripe Elements appearance (dark theme for our UI)
    const appearance = {
        theme: 'night',
        variables: {
            colorPrimary: '#3b82f6',
            colorBackground: '#0a0a0f',
            colorText: '#ffffff',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '12px',
        },
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-midnight border border-white/10 rounded-2xl p-6 w-full max-w-md relative">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-all"
                >
                    <X size={24} />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gold/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <DollarSign size={32} className="text-gold" />
                    </div>
                    <h2 className="text-2xl font-black text-gold">Tip the DJ</h2>
                    <p className="text-white/50 text-sm mt-1">${amount} tip for your request</p>
                </div>

                {/* Payment Form */}
                {loading && (
                    <div className="text-center text-white/50 py-8">
                        Loading payment form...
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-center text-red-400 mb-4">
                        {error}
                    </div>
                )}

                {clientSecret && (
                    <Elements
                        stripe={stripePromise}
                        options={{
                            clientSecret,
                            appearance,
                        }}
                    >
                        <CheckoutForm amount={amount} requestId={requestId} onClose={onClose} />
                    </Elements>
                )}
            </div>
        </div>
    );
}
