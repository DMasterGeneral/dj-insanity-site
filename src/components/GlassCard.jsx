export default function GlassCard({ children, className = '', span = '' }) {
    return (
        <div className={`glass-card relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 ${span} ${className}`}>
            {children}
        </div>
    );
}
