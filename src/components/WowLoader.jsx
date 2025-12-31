import { useState, useEffect } from 'react';
import { Disc } from 'lucide-react';

export default function WowLoader({ onComplete }) {
    const [phase, setPhase] = useState('drawing'); // drawing, spinning, waveform, text

    useEffect(() => {
        const timers = [
            setTimeout(() => setPhase('spinning'), 2600),
            setTimeout(() => setPhase('waveform'), 4200),
            setTimeout(() => setPhase('text'), 5800),
            setTimeout(() => setPhase('exit'), 7000),
            setTimeout(() => onComplete(), 7800),
        ];
        return () => timers.forEach(clearTimeout);
    }, [onComplete]);

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-midnight ${phase === 'exit' ? 'loader-exit' : ''}`}>
            <div className="relative w-64 h-64">
                {/* SVG Turntable */}
                {(phase === 'drawing' || phase === 'spinning') && (
                    <svg
                        viewBox="0 0 200 200"
                        className={`w-full h-full ${phase === 'spinning' ? 'spin-turntable' : ''}`}
                    >
                        {/* Outer circle */}
                        <circle
                            cx="100" cy="100" r="90"
                            fill="none"
                            stroke="white"
                            strokeWidth="2"
                            className="draw-path"
                        />
                        {/* Inner circles (grooves) */}
                        <circle
                            cx="100" cy="100" r="70"
                            fill="none"
                            stroke="white"
                            strokeWidth="1"
                            opacity="0.5"
                            className="draw-path"
                            style={{ animationDelay: '0.3s' }}
                        />
                        <circle
                            cx="100" cy="100" r="50"
                            fill="none"
                            stroke="white"
                            strokeWidth="1"
                            opacity="0.5"
                            className="draw-path"
                            style={{ animationDelay: '0.6s' }}
                        />
                        {/* Center label */}
                        <circle
                            cx="100" cy="100" r="25"
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2"
                            className="draw-path"
                            style={{ animationDelay: '0.9s' }}
                        />
                        {/* Center dot */}
                        <circle
                            cx="100" cy="100" r="5"
                            fill="white"
                            className="draw-path"
                            style={{ animationDelay: '1.2s' }}
                        />
                        {/* Tonearm */}
                        <path
                            d="M 160 40 L 160 80 L 120 100"
                            fill="none"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                            className="draw-path"
                            style={{ animationDelay: '1.5s' }}
                        />
                        {/* Cartridge */}
                        <rect
                            x="115" y="95"
                            width="12" height="8"
                            fill="#2563EB"
                            className="draw-path"
                            style={{ animationDelay: '1.8s' }}
                        />
                    </svg>
                )}

                {/* Waveform Visualizer */}
                {phase === 'waveform' && (
                    <div className="flex items-center justify-center h-full gap-2">
                        {[40, 70, 100, 60, 45].map((height, i) => (
                            <div
                                key={i}
                                className="waveform-bar w-4 bg-gradient-to-t from-electric to-white rounded-full"
                                style={{ height: `${height}px` }}
                            />
                        ))}
                    </div>
                )}

                {/* Text Reveal */}
                {(phase === 'text' || phase === 'exit') && (
                    <div className="flex items-center justify-center h-full">
                        <h1 className="text-reveal text-4xl font-black tracking-wider bg-gradient-to-r from-white via-electric to-white bg-clip-text text-transparent">
                            DJ INSANITY
                        </h1>
                    </div>
                )}
            </div>
        </div>
    );
}
