import { Zap } from 'lucide-react';
import GlassCard from './GlassCard';

const gearItems = [
    { name: 'Pioneer CDJ-3000', price: '$2,500', desc: 'Professional DJ Multi Player', img: '🎛️' },
    { name: 'DJM-A9 Mixer', price: '$3,200', desc: '4-Channel Professional Mixer', img: '🎚️' },
    { name: 'QSC KW153', price: '$1,800', desc: '15" 3-Way Active Loudspeaker', img: '🔊' },
    { name: 'Chauvet Fog Machine', price: '$400', desc: 'Hurricane 1800 Flex', img: '🌫️' },
    { name: 'Moving Head Lights', price: '$600', desc: 'ADJ Focus Spot 4Z', img: '💡' },
    { name: 'Laser System', price: '$900', desc: 'X-Laser Mobile Beat MAX', img: '✨' },
];

export default function GearLocker() {
    return (
        <GlassCard span="md:col-span-2" className="overflow-hidden">
            <div className="flex items-center gap-2 text-electric mb-4">
                <Zap size={20} />
                <h2 className="font-bold text-lg">Gear Locker</h2>
                <span className="text-white/40 text-sm ml-auto">Scroll →</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar -mx-2 px-2">
                {gearItems.map((item, i) => (
                    <div
                        key={i}
                        className="gear-card flex-shrink-0 w-48 bg-white/5 border border-white/10 rounded-xl p-4 hover:border-electric/50 hover:glow-blue transition-all cursor-pointer group"
                    >
                        <div className="text-5xl mb-3">{item.img}</div>
                        <h3 className="font-bold text-sm">{item.name}</h3>
                        <div className="gear-details mt-2 space-y-1">
                            <p className="text-electric font-bold">{item.price}</p>
                            <p className="text-white/50 text-xs">{item.desc}</p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
}
