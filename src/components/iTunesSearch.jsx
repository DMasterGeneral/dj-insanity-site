import { useState, useCallback } from 'react';
import { Search, X, Music2 } from 'lucide-react';

// JSONP helper for iTunes API (required for mobile Safari CORS support)
let jsonpCounter = 0;
const jsonp = (url) => {
    return new Promise((resolve, reject) => {
        const callbackName = `itunes_callback_${++jsonpCounter}`;
        const script = document.createElement('script');

        // Cleanup function
        const cleanup = () => {
            delete window[callbackName];
            script.remove();
        };

        // Set timeout for request
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Request timeout'));
        }, 10000);

        // Define callback
        window[callbackName] = (data) => {
            clearTimeout(timeout);
            cleanup();
            resolve(data);
        };

        // Add callback to URL and execute
        script.src = `${url}&callback=${callbackName}`;
        script.onerror = () => {
            clearTimeout(timeout);
            cleanup();
            reject(new Error('Script load error'));
        };

        document.head.appendChild(script);
    });
};

export default function iTunesSearch({ onSelectSong }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const searchSongs = useCallback(async () => {
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        try {
            // Use JSONP for cross-browser/mobile compatibility
            const data = await jsonp(
                `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=10`
            );
            setResults(data.results || []);
        } catch (error) {
            console.error('Search error:', error);
            setResults([]);
        }
        setLoading(false);
    }, [query]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchSongs();
        }
    };

    const handleSelect = (track) => {
        // Pass song info back to parent
        onSelectSong({
            title: `${track.trackName} - ${track.artistName}`,
            link: track.trackViewUrl,
            artwork: track.artworkUrl100
        });
        // Clear search
        setQuery('');
        setResults([]);
        setSearched(false);
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

            {/* Results */}
            {searched && (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="p-4 text-center text-white/40">
                            {loading ? 'Searching...' : 'No results found'}
                        </div>
                    ) : (
                        results.map((track, index) => (
                            <button
                                key={track.trackId || index}
                                type="button"
                                onClick={() => handleSelect(track)}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-all text-left border-b border-white/5 last:border-b-0"
                            >
                                {track.artworkUrl60 ? (
                                    <img
                                        src={track.artworkUrl60}
                                        alt=""
                                        className="w-12 h-12 rounded-lg object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
                                        <Music2 size={20} className="text-white/30" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{track.trackName}</p>
                                    <p className="text-white/50 text-sm truncate">{track.artistName}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
