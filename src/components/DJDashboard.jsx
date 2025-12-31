import { useState, useEffect } from 'react';
import { ArrowUpDown, Check, Archive, Disc } from 'lucide-react';
import { subscribeToRequests, archiveRequest, signInDJ, signOutDJ, onAuthChange } from '../lib/firebase';

export default function DJDashboard() {
    const [sortBy, setSortBy] = useState('time');
    const [now, setNow] = useState(Date.now());
    const [requests, setRequests] = useState([]);
    const [user, setUser] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    // Auth state listener
    useEffect(() => {
        const unsubscribe = onAuthChange((user) => {
            setUser(user);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Live time update
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // Subscribe to requests when authenticated
    useEffect(() => {
        if (!user) return;
        const unsubscribe = subscribeToRequests((reqs) => {
            setRequests(reqs);
        });
        return unsubscribe;
    }, [user]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signInDJ(email, password);
        } catch (err) {
            setError(err.message || 'Login failed');
        }
    };

    const handleLogout = async () => {
        await signOutDJ();
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return 'just now';
        const ts = timestamp.toDate ? timestamp.toDate().getTime() : timestamp;
        const diff = Math.floor((now - ts) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    const sortedRequests = [...requests]
        .filter(r => r.status !== 'archived')
        .sort((a, b) => {
            if (sortBy === 'tip') return (b.tip || 0) - (a.tip || 0);
            const aTime = a.timestamp?.toDate?.() || new Date(0);
            const bTime = b.timestamp?.toDate?.() || new Date(0);
            return bTime - aTime;
        });

    const handleArchive = async (id) => {
        await archiveRequest(id);
    };

    if (loading) {
        return (
            <div className="noise-bg min-h-screen text-white flex items-center justify-center">
                <div className="text-electric">Loading...</div>
            </div>
        );
    }

    // Login screen
    if (!user) {
        return (
            <div className="noise-bg min-h-screen text-white flex items-center justify-center p-6">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-sm w-full">
                    <div className="text-center mb-6">
                        <Disc size={40} className="mx-auto text-electric" />
                        <h1 className="text-2xl font-black text-electric mt-4">DJ Dashboard</h1>
                        <p className="text-white/50 text-sm mt-2">Sign in to access</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="email"
                            placeholder="Email"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        <button
                            type="submit"
                            className="w-full py-3 bg-electric rounded-xl font-bold hover:bg-electric/80 transition-all"
                        >
                            Sign In
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="noise-bg min-h-screen text-white p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-black text-electric">DJ Dashboard</h1>
                        <p className="text-white/50 text-sm">{sortedRequests.length} pending requests</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Sort Toggle */}
                        <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                            <button
                                onClick={() => setSortBy('time')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${sortBy === 'time' ? 'bg-electric' : 'text-white/50'
                                    }`}
                            >
                                <ArrowUpDown size={16} /> Time
                            </button>
                            <button
                                onClick={() => setSortBy('tip')}
                                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${sortBy === 'tip' ? 'bg-gold text-black' : 'text-white/50'
                                    }`}
                            >
                                <ArrowUpDown size={16} /> Tip $
                            </button>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 bg-white/10 rounded-xl text-sm hover:bg-white/20 transition-all"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 p-4 border-b border-white/10 text-white/50 text-sm font-semibold">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Request</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-2">Tip</div>
                        <div className="col-span-2">Actions</div>
                    </div>

                    {/* Table Body */}
                    {sortedRequests.length === 0 ? (
                        <div className="p-8 text-center text-white/40">
                            No pending requests. Waiting for songs...
                        </div>
                    ) : (
                        sortedRequests.map((req, i) => (
                            <div
                                key={req.id}
                                className={`grid grid-cols-12 gap-4 p-4 border-b border-white/5 hover:bg-white/5 transition-all items-center ${(req.tip || 0) >= 10 ? 'border-l-4 border-l-gold' : ''
                                    }`}
                            >
                                <div className="col-span-1 text-white/40">{i + 1}</div>
                                <div className="col-span-5">
                                    {req.content?.startsWith('http') ? (
                                        <a
                                            href={req.content}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium text-electric hover:underline truncate block"
                                        >
                                            {req.title || req.content}
                                        </a>
                                    ) : (
                                        <p className="font-medium truncate">{req.title || req.content}</p>
                                    )}
                                    <p className="text-white/40 text-xs">{getTimeAgo(req.timestamp)}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${req.type === 'link' ? 'bg-electric/20 text-electric' : 'bg-purple-500/20 text-purple-400'
                                        }`}>
                                        {req.type === 'link' ? '🔗 Link' : '🎵 Search'}
                                    </span>
                                </div>
                                <div className="col-span-2">
                                    {(req.tip || 0) > 0 ? (
                                        <span className="text-gold font-bold">${req.tip}</span>
                                    ) : (
                                        <span className="text-white/30">—</span>
                                    )}
                                </div>
                                <div className="col-span-2 flex gap-2">
                                    <button
                                        onClick={() => handleArchive(req.id)}
                                        className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                                        title="Mark as played"
                                    >
                                        <Check size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleArchive(req.id)}
                                        className="p-2 bg-white/10 text-white/50 rounded-lg hover:bg-white/20 transition-all"
                                        title="Archive"
                                    >
                                        <Archive size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
