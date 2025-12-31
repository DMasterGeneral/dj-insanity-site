import { Disc } from 'lucide-react';
import GlassCard from './GlassCard';

export default function HeroCard({ onShowTestimonials }) {
    return (
        <GlassCard span="md:col-span-2 md:row-span-2" className="overflow-hidden min-h-[400px]">
            {/* Background gradient as placeholder for DJ image */}
            <div className="absolute inset-0 bg-gradient-to-br from-electric/30 via-purple-900/40 to-midnight">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(37,99,235,0.4),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.3),transparent_50%)]" />
            </div>

            {/* Glassmorphism overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/60 to-transparent" />

            {/* Content */}
            <div className="relative z-10 h-full flex flex-col justify-end">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-electric">
                        <Disc size={20} />
                        <span className="text-sm font-semibold tracking-widest uppercase">Live From LA</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                        DJ <span className="text-electric">INSANITY</span>
                    </h1>
                    <p className="text-white/60 text-lg max-w-md">
                        Elevating nightlife experiences with cutting-edge sound design.
                        Weddings • Clubs • Private Events
                    </p>
                    <div className="flex gap-4 pt-4">
                        <button className="px-6 py-3 bg-electric hover:bg-electric/80 rounded-xl font-semibold transition-all hover:scale-105 glow-blue">
                            Book Now
                        </button>
                        <button
                            onClick={onShowTestimonials}
                            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-all border border-white/20"
                        >
                            Testimonials
                        </button>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
