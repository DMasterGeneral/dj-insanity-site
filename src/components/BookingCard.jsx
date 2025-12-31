import { useState } from 'react';
import { Calendar } from 'lucide-react';
import GlassCard from './GlassCard';
import { addBooking } from '../lib/firebase';

export default function BookingCard() {
    const [formData, setFormData] = useState({ name: '', email: '', date: '', eventType: '' });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.date || !formData.eventType) return;

        setSubmitting(true);
        try {
            await addBooking(formData);
            setSubmitted(true);
            setFormData({ name: '', email: '', date: '', eventType: '' });
        } catch (error) {
            console.error('Booking error:', error);
        }
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <GlassCard className="flex flex-col items-center justify-center text-center">
                <div className="text-electric text-5xl mb-4">✓</div>
                <h2 className="font-bold text-xl mb-2">Request Received!</h2>
                <p className="text-white/60">We'll get back to you soon.</p>
                <button
                    onClick={() => setSubmitted(false)}
                    className="mt-4 text-electric underline"
                >
                    Submit another
                </button>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="flex flex-col">
            <div className="flex items-center gap-2 text-electric mb-4">
                <Calendar size={20} />
                <h2 className="font-bold text-lg">Quick Booking</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col">
                <input
                    type="text"
                    placeholder="Your Name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
                <input
                    type="email"
                    placeholder="Email Address"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
                <input
                    type="date"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all text-white/70 [color-scheme:dark]"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                />
                <select
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all text-white/70"
                    value={formData.eventType}
                    onChange={e => setFormData({ ...formData, eventType: e.target.value })}
                >
                    <option value="" className="bg-midnight">Event Type</option>
                    <option value="wedding" className="bg-midnight">Wedding</option>
                    <option value="club" className="bg-midnight">Club Night</option>
                    <option value="private" className="bg-midnight">Private Party</option>
                    <option value="corporate" className="bg-midnight">Corporate Event</option>
                </select>
                <button
                    type="submit"
                    disabled={submitting}
                    className="mt-auto w-full py-3 bg-gradient-to-r from-electric to-blue-400 rounded-xl font-bold hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                    {submitting ? 'Sending...' : 'Check Availability'}
                </button>
            </form>
        </GlassCard>
    );
}
