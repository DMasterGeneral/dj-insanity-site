import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc } from 'lucide-react';

import HeroCard from '../../components/HeroCard';
import BookingCard from '../../components/BookingCard';
import GearLocker from '../../components/GearLocker';
import TestimonialsMarquee from '../../components/TestimonialsMarquee';
import TestimonialsPage from '../../components/TestimonialsPage';
import LiveModeToggle from '../../components/LiveModeToggle';

// Original landing page (v1), kept as-is at / and /classic
export default function Classic() {
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
        <p>© {new Date().getFullYear()} DJ Insanity. All rights reserved.</p>
        <p className="mt-2 text-white/20">Click the music icon to access Live Mode 🎵</p>
        {/* Temporary: preview page for choosing the new intro animation */}
        <p className="mt-2">
          <a href="/intros/index.html" className="text-white/40 underline hover:text-white transition-all">
            Preview intro options
          </a>
        </p>
      </footer>

      <LiveModeToggle onClick={() => navigate('/request')} isActive={false} />
    </div>
  );
}
