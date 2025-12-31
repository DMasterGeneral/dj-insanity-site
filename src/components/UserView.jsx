import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link, Music, Send, Home, DollarSign } from 'lucide-react';
import { addSongRequest } from '../lib/firebase';
import ITunesSearch from './iTunesSearch';
import TipDJ from './TipDJ';

// Generate unique request ID
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export default function UserView() {
    const navigate = useNavigate();
    const [inputMode, setInputMode] = useState('search'); // 'search' or 'link'
    const [linkValue, setLinkValue] = useState('');
    const [selectedSong, setSelectedSong] = useState(null);
    const [tipAmount, setTipAmount] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showTipModal, setShowTipModal] = useState(false);
    const [currentRequestId, setCurrentRequestId] = useState(null);

    const handleSongSelect = (song) => {
        setSelectedSong(song);
        setInputMode('search');
    };

    // Build the song request object
    const buildSongRequest = () => {
        const content = inputMode === 'link' ? linkValue : selectedSong?.link;
        const title = inputMode === 'link' ? linkValue : selectedSong?.title;

        if (!content) return null;

        return {
            type: inputMode === 'link' ? 'link' : 'search',
            content: content,
            title: title,
        };
    };

    // Submit to Firebase (for no-tip requests only)
    const submitToFirebase = async () => {
        const songRequest = buildSongRequest();
        if (!songRequest) return;

        setSubmitting(true);
        try {
            await addSongRequest({
                ...songRequest,
                tip: 0,
            });
            resetForm();
        } catch (error) {
            console.error('Request error:', error);
        }
        setSubmitting(false);
    };

    const resetForm = () => {
        setLinkValue('');
        setSelectedSong(null);
        setTipAmount(0);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
    };

    // Handle submit button click
    const handleSubmit = async () => {
        const songRequest = buildSongRequest();
        if (!songRequest) return;

        if (tipAmount > 0) {
            // Generate unique ID for this request
            const requestId = generateRequestId();
            setCurrentRequestId(requestId);

            // Store pending request in sessionStorage (per-tab, survives refresh but not tab close)
            const pendingData = {
                ...songRequest,
                tip: tipAmount,
                createdAt: Date.now(),
            };
            sessionStorage.setItem(`pending_request_${requestId}`, JSON.stringify(pendingData));

            // Open Stripe modal
            setShowTipModal(true);
        } else {
            // No tip, submit directly to Firebase
            await submitToFirebase();
        }
    };

    // Close tip modal without completing payment
    const handleTipModalClose = () => {
        setShowTipModal(false);
        // Don't remove from sessionStorage - user might retry
        // Old entries will be cleaned up by PaymentSuccess or browser close
    };

    return (
        <div className="noise-bg min-h-screen text-white p-4 pb-24">
            <div className="max-w-md mx-auto space-y-6">
                {/* Header */}
                <div className="text-center py-6">
                    <h1 className="text-2xl font-black text-electric">Request a Song</h1>
                    <p className="text-white/50 text-sm mt-1">DJ Insanity • Live Now</p>
                </div>

                {submitted && (
                    <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 text-center text-green-400">
                        ✓ Request submitted!
                    </div>
                )}

                {/* Input Mode Toggle */}
                <div className="flex bg-white/5 rounded-xl p-1">
                    <button
                        type="button"
                        onClick={() => setInputMode('search')}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${inputMode === 'search' ? 'bg-electric' : 'text-white/50'
                            }`}
                    >
                        <Music size={20} /> Search
                    </button>
                    <button
                        type="button"
                        onClick={() => setInputMode('link')}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${inputMode === 'link' ? 'bg-electric' : 'text-white/50'
                            }`}
                    >
                        <Link size={20} /> Paste Link
                    </button>
                </div>

                {/* Search Mode */}
                {inputMode === 'search' && (
                    <div className="space-y-4">
                        <ITunesSearch onSelectSong={handleSongSelect} />

                        {/* Selected Song Preview */}
                        {selectedSong && (
                            <div className="bg-electric/20 border border-electric/50 rounded-xl p-4 flex items-center gap-3">
                                {selectedSong.artwork && (
                                    <img
                                        src={selectedSong.artwork}
                                        alt=""
                                        className="w-14 h-14 rounded-lg"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-electric truncate">Selected:</p>
                                    <p className="text-white/80 truncate">{selectedSong.title}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedSong(null)}
                                    className="text-white/40 hover:text-white/80"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Link Mode */}
                {inputMode === 'link' && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <textarea
                            placeholder="Paste YouTube, Spotify, SoundCloud, or Apple Music link..."
                            className="w-full h-32 bg-transparent text-white placeholder:text-white/30 focus:outline-none resize-none text-lg"
                            value={linkValue}
                            onChange={(e) => setLinkValue(e.target.value)}
                        />
                    </div>
                )}

                {/* Tip Selector */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign size={18} className="text-gold" />
                        <p className="text-white/50 text-sm">Add a tip to boost your request</p>
                    </div>
                    <div className="flex gap-2">
                        {[0, 5, 10, 20].map((amount) => (
                            <button
                                key={amount}
                                type="button"
                                onClick={() => setTipAmount(amount)}
                                className={`flex-1 py-2 rounded-xl font-bold transition-all ${tipAmount === amount
                                        ? 'bg-gold text-black'
                                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                                    }`}
                            >
                                {amount === 0 ? 'No Tip' : `$${amount}`}
                            </button>
                        ))}
                    </div>
                    {tipAmount > 0 && (
                        <p className="text-gold/70 text-xs text-center mt-2">
                            💳 Payment will be processed securely via Stripe
                        </p>
                    )}
                </div>

                {/* Submit Button */}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || (inputMode === 'search' ? !selectedSong : !linkValue.trim())}
                    className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${tipAmount > 0
                            ? 'bg-gradient-to-r from-gold to-yellow-500 text-black'
                            : 'bg-gradient-to-r from-electric to-blue-400 text-white'
                        }`}
                >
                    <Send size={20} />
                    {submitting
                        ? 'Sending...'
                        : tipAmount > 0
                            ? `Submit with $${tipAmount} Tip`
                            : 'Submit Request'}
                </button>
            </div>

            {/* Home Button */}
            <button
                onClick={() => navigate('/')}
                className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
                title="Back to Home"
            >
                <Home size={20} />
            </button>

            {/* Stripe Tip Modal */}
            <TipDJ
                isOpen={showTipModal}
                onClose={handleTipModalClose}
                amount={tipAmount}
                requestId={currentRequestId}
            />
        </div>
    );
}
