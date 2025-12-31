import GlassCard from './GlassCard';

const testimonials = [
    { text: "Absolutely insane energy! Best DJ we've ever booked.", author: "Sarah M." },
    { text: "Made our wedding unforgettable. 10/10 would recommend!", author: "James & Lisa" },
    { text: "The crowd was going crazy all night long.", author: "Club Neon NYC" },
    { text: "Professional, punctual, and incredibly talented.", author: "Mike T." },
    { text: "DJ Insanity knows exactly how to read the room.", author: "Amanda K." },
    { text: "Booked for 3 events so far. Never disappoints!", author: "EventPro Inc." },
];

export default function TestimonialsMarquee() {
    return (
        <GlassCard span="md:col-span-3" className="overflow-hidden">
            <h2 className="font-bold text-lg mb-4 text-electric">What People Say</h2>
            <div className="overflow-hidden">
                <div className="marquee-track">
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <div key={i} className="flex-shrink-0 w-72 mx-4 bg-white/5 border border-white/10 rounded-xl p-4">
                            <p className="text-white/80 text-sm italic">"{t.text}"</p>
                            <p className="text-electric text-xs mt-2 font-semibold">— {t.author}</p>
                        </div>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
}
