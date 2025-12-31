import { useState } from 'react';
import { Disc } from 'lucide-react';
import './index.css';

import WowLoader from './components/WowLoader';
import HeroCard from './components/HeroCard';
import BookingCard from './components/BookingCard';
import GearLocker from './components/GearLocker';
import TestimonialsMarquee from './components/TestimonialsMarquee';
import TestimonialsPage from './components/TestimonialsPage';
import UserView from './components/UserView';
import DJDashboard from './components/DJDashboard';
import LiveModeToggle from './components/LiveModeToggle';

function App() {
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [viewMode, setViewMode] = useState('user'); // 'user' or 'dj'
  const [showTestimonials, setShowTestimonials] = useState(false);

  if (loading) {
    return <WowLoader onComplete={() => setLoading(false)} />;
  }

  if (showTestimonials) {
    return <TestimonialsPage onBack={() => setShowTestimonials(false)} />;
  }

  if (liveMode) {
    return (
      <div className="noise-bg min-h-screen text-white">
        {/* View Mode Toggle for Demo */}
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex bg-white/10 backdrop-blur-xl rounded-full p-1">
          <button
            onClick={() => setViewMode('user')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${viewMode === 'user' ? 'bg-electric' : 'text-white/50'
              }`}
          >
            📱 User View
          </button>
          <button
            onClick={() => setViewMode('dj')}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${viewMode === 'dj' ? 'bg-electric' : 'text-white/50'
              }`}
          >
            🎧 DJ Dashboard
          </button>
        </div>

        {viewMode === 'user' ? <UserView /> : <DJDashboard />}

        <LiveModeToggle onClick={() => setLiveMode(false)} isActive={true} />
      </div>
    );
  }

  return (
    <div className="noise-bg min-h-screen text-white p-4 md:p-8">
      {/* Navigation */}
      <nav className="flex items-center justify-between mb-8 max-w-7xl mx-auto relative z-10">
        <div className="flex items-center gap-2">
          <Disc size={20} />
          <span className="font-bold text-lg">DJ INSANITY</span>
        </div>
        <div className="flex items-center gap-6 text-white/50">
          <a href="#" className="hover:text-white transition-all">About</a>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); setShowTestimonials(true); }}
            className="hover:text-white transition-all"
          >
            Testimonials
          </a>
          <a href="#" className="hover:text-white transition-all">Contact</a>
        </div>
      </nav>

      {/* Bento Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 relative z-10">
        <HeroCard onShowTestimonials={() => setShowTestimonials(true)} />
        <BookingCard />
        <GearLocker />
        <TestimonialsMarquee />
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/10 text-center text-white/40 text-sm relative z-10">
        <p>© 2025 DJ Insanity. All rights reserved.</p>
        <p className="mt-2 text-white/20">Click the music icon to access Live Mode 🎵</p>
      </footer>

      <LiveModeToggle onClick={() => setLiveMode(true)} isActive={false} />
    </div>
  );
}

export default App;
