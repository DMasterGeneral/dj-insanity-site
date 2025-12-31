import { Music } from 'lucide-react';

export default function LiveModeToggle({ onClick, isActive }) {
    return (
        <button
            onClick={onClick}
            className={`fixed bottom-6 right-6 z-40 p-4 rounded-full transition-all ${isActive
                ? 'bg-electric glow-blue'
                : 'bg-white/10 hover:bg-white/20 border border-white/20'
                }`}
            title="Toggle Live Mode"
        >
            <Music size={20} />
        </button>
    );
}
