import { useState } from 'react';
import { Link, Music, Send, AlertTriangle, Apple } from 'lucide-react';
import { addSongRequest } from '../lib/firebase';

function WarningModal({ onClose, onConfirm }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-midnight border border-yellow-500/50 rounded-2xl p-6 max-w-sm w-full">
                <div className="flex items-center gap-3 text-yellow-500 mb-4">
                    <AlertTriangle size={24} />
                    <h3 className="font-bold text-lg">Link Preferred</h3>
                </div>
                <p className="text-white/70 mb-6">
                    For best accuracy, please paste a YouTube or SoundCloud link.
                    Raw text may result in the wrong song being played.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-white/10 rounded-xl font-semibold hover:bg-white/20 transition-all"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 rounded-xl font-semibold hover:bg-yellow-500/30 transition-all"
                    >
                        Continue Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function UserView() {
    const [inputType, setInputType] = useState('link');
    const [inputValue, setInputValue] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [tipAmount, setTipAmount] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (inputType === 'text' && !showWarning) {
            setShowWarning(true);
            return;
        }
        if (inputValue.trim()) {
            try {
                await addSongRequest({
                    type: inputType,
                    content: inputValue,
                    tip: tipAmount,
                });
                setInputValue('');
                setTipAmount(0);
                setSubmitted(true);
                setTimeout(() => setSubmitted(false), 3000);
            } catch (error) {
                console.error('Request error:', error);
            }
        }
    };

    return (
        <div className="min-h-screen bg-midnight p-4 pb-24">
            {showWarning && (
                <WarningModal
                    onClose={() => setShowWarning(false)}
                    onConfirm={() => {
                        setShowWarning(false);
                        handleSubmit();
                    }}
                />
            )}

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

                {/* Input Type Toggle */}
                <div className="flex bg-white/5 rounded-xl p-1">
                    <button
                        onClick={() => setInputType('link')}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${inputType === 'link' ? 'bg-electric' : 'text-white/50'
                            }`}
                    >
                        <Link size={20} /> Link
                    </button>
                    <button
                        onClick={() => setInputType('text')}
                        className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${inputType === 'text' ? 'bg-electric' : 'text-white/50'
                            }`}
                    >
                        <Music size={20} /> Raw Text
                    </button>
                </div>

                {/* Input Field */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <textarea
                        placeholder={inputType === 'link'
                            ? "Paste YouTube or SoundCloud link..."
                            : "Enter song name and artist..."
                        }
                        className="w-full h-32 bg-transparent text-white placeholder:text-white/30 focus:outline-none resize-none text-lg"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                    />
                </div>

                {/* Tip Section */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-white/50 text-sm mb-3">Add a tip to boost your request</p>
                    <div className="flex gap-2">
                        {[0, 5, 10, 20].map(amount => (
                            <button
                                key={amount}
                                onClick={() => setTipAmount(amount)}
                                className={`flex-1 py-2 rounded-xl font-bold transition-all ${tipAmount === amount
                                    ? 'bg-gold text-black glow-gold'
                                    : 'bg-white/10 text-white/70'
                                    }`}
                            >
                                {amount === 0 ? 'No Tip' : `$${amount}`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    className="w-full py-4 bg-gradient-to-r from-electric to-blue-400 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                >
                    <Send size={20} /> Submit Request
                </button>

                {/* Apple Pay Mockup */}
                <button className="w-full py-4 bg-black border-2 border-gold/50 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 glow-gold hover:border-gold transition-all pulse-slow">
                    <Apple size={20} /> Pay with Apple Pay
                </button>
            </div>
        </div>
    );
}
