import { useState, useCallback } from 'react';
import { Search, X, Music2 } from 'lucide-react';

export default function MusicSearch({ onSelectSong }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');

    const searchSongs = useCallback(async () => {
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        setError('');
        setResults([]);

        // Try multiple approaches for best compatibility
        const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10`;

        try {
            // Approach 1: Direct fetch (works on desktop, may fail on mobile)
            const response = await fetch(iTunesUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    setResults(data.results.map(track => ({
                        id: track.trackId,
                        title: track.trackName,
                        artist: track.artistName,
                        artwork: track.artworkUrl60,
                        artworkLarge: track.artworkUrl100,
                        link: track.trackViewUrl
                    })));
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.log('Direct fetch failed, trying proxy...');
        }

        try {
            // Approach 2: CORS proxy fallback
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(iTunesUrl)}`;
            const response = await fetch(proxyUrl);
            if (response.ok) {
                const data = await response.json();
                if (data.results) {
                    setResults(data.results.map(track => ({
                        id: track.trackId,
                        title: track.trackName,
                        artist: track.artistName,
                        artwork: track.artworkUrl60,
                        artworkLarge: track.artworkUrl100,
                        link: track.trackViewUrl
                    })));
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.log('Proxy fetch also failed');
        }

        // Both failed
        setError('Search unavailable. Try pasting a link instead.');
        setLoading(false);
    }, [query]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchSongs();
        }
    };

    const handleSelect = (track) => {
        onSelectSong({
            title: `${track.title} - ${track.artist}`,
            link: track.link,
            artwork: track.artworkLarge || track.artwork
        });
        setQuery('');
        setResults([]);
        setSearched(false);
        setError('');
    };

    return (
        <div className="space-y-3">
            {/* Search Input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search for a song..."
                        className="w-full px-4 py-3 pl-10 bg-white/5 border border-white/10 rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    {query && (
                        <button
                            type="button"
                            onClick={() => {
                                setQuery('');
                                setResults([]);
                                setSearched(false);
                                setError('');
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
                <button
                    type="button"
                    onClick={searchSongs}
                    disabled={loading || !query.trim()}
                    className="px-4 py-3 bg-electric rounded-xl font-semibold hover:bg-electric/80 transition-all disabled:opacity-50"
                >
                    {loading ? '...' : 'Search'}
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="text-orange-400 text-sm text-center py-2">
                    {error}
                </div>
            )}

            {/* Results */}
            {searched && !error && (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="p-4 text-center text-white/40">
                            {loading ? 'Searching...' : 'No results found'}
                        </div>
                    ) : (
                        results.map((track, index) => (
                            <button
                                key={track.id || index}
                                type="button"
                                onClick={() => handleSelect(track)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-b-0"
                            >
                                {track.artwork ? (
                                    <img
                                        src={track.artwork}
                                        alt=""
                                        className="w-12 h-12 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                                        <Music2 size={20} className="text-white/30" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{track.title}</p>
                                    <p className="text-white/50 text-sm truncate">{track.artist}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
