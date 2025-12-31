import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
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

// Main Landing Page Component
function LandingPage() {
  const [showTestimonials, setShowTestimonials] = useState(false);
  const navigate = useNavigate();

  if (showTestimonials) {
    return <TestimonialsPage onBack={() => setShowTestimonials(false)} />;
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

      <LiveModeToggle onClick={() => navigate('/request')} isActive={false} />
    </div>
  );
}

// App with Router
function AppContent() {
  const [loading, setLoading] = useState(true);

  if (loading) {
    return <WowLoader onComplete={() => setLoading(false)} />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/request" element={<UserView />} />
      <Route path="/dj" element={<DJDashboard />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
