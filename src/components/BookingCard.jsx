import { useState } from 'react';
import { Calendar, Phone, MessageSquare } from 'lucide-react';
import GlassCard from './GlassCard';
import { addBooking } from '../lib/firebase';

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      times.push({ display, value });
    }
  }
  return times;
};

const timeOptions = generateTimeOptions();

export default function BookingCard() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    contactPreference: 'text',
    date: '',
    startTime: '',
    endTime: '',
    eventType: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = true;
    if (!formData.phone.trim()) newErrors.phone = true;
    if (!formData.date) newErrors.date = true;
    if (!formData.startTime) newErrors.startTime = true;
    if (!formData.endTime) newErrors.endTime = true;
    if (!formData.eventType) newErrors.eventType = true;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      await addBooking({
        ...formData,
        // Format time range for display (handles overnight)
        timeRange: `${formData.startTime} - ${formData.endTime}`
      });
      setSubmitted(true);
      setFormData({
        name: '',
        phone: '',
        contactPreference: 'text',
        date: '',
        startTime: '',
        endTime: '',
        eventType: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Booking error:', error);
    }
    setSubmitting(false);
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 bg-white/5 border rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30 ${errors[field] ? 'border-red-500 ring-1 ring-red-500' : 'border-white/10'
    }`;

  const selectClass = (field) =>
    `w-full px-4 py-3 bg-white/5 border rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all ${errors[field] ? 'border-red-500 ring-1 ring-red-500 text-white/70' : 'border-white/10 text-white/70'
    }`;

  if (submitted) {
    return (
      <GlassCard className="flex flex-col items-center justify-center text-center">
        <div className="text-electric text-5xl mb-4">✓</div>
        <h2 className="font-bold text-xl mb-2">Request Received!</h2>
        <p className="text-white/60">We'll get back to you soon.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-electric underline"
        >
          Submit another
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col">
      <div className="flex items-center gap-2 text-electric mb-4">
        <Calendar size={20} />
        <h2 className="font-bold text-lg">Quick Booking</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 flex-1 flex flex-col">
        {/* Name */}
        <input
          type="text"
          placeholder="Your Name"
          className={inputClass('name')}
          value={formData.name}
          onChange={e => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: false });
          }}
        />

        {/* Phone + Contact Preference */}
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="Phone Number"
            className={`${inputClass('phone')} flex-1`}
            value={formData.phone}
            onChange={e => {
              setFormData({ ...formData, phone: e.target.value });
              if (errors.phone) setErrors({ ...errors, phone: false });
            }}
          />
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, contactPreference: 'call' })}
              className={`px-3 py-2 flex items-center gap-1 text-sm transition-all ${formData.contactPreference === 'call'
                ? 'bg-electric text-white'
                : 'text-white/50 hover:text-white/80'
                }`}
              title="Prefer Call"
            >
              <Phone size={16} />
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, contactPreference: 'text' })}
              className={`px-3 py-2 flex items-center gap-1 text-sm transition-all ${formData.contactPreference === 'text'
                ? 'bg-electric text-white'
                : 'text-white/50 hover:text-white/80'
                }`}
              title="Prefer Text"
            >
              <MessageSquare size={16} />
            </button>
          </div>
        </div>

        {/* Date */}
        <div className="relative">
          <input
            type="date"
            className={`${inputClass('date')} [color-scheme:dark] appearance-none min-h-[48px]`}
            style={{
              color: formData.date ? 'rgba(255,255,255,0.7)' : 'transparent',
            }}
            value={formData.date}
            onChange={e => {
              setFormData({ ...formData, date: e.target.value });
              if (errors.date) setErrors({ ...errors, date: false });
            }}
          />
          {!formData.date && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
              Select Event Date
            </span>
          )}
        </div>

        {/* Time Range */}
        <div className="flex gap-2 items-center">
          <select
            className={selectClass('startTime')}
            value={formData.startTime}
            onChange={e => {
              setFormData({ ...formData, startTime: e.target.value });
              if (errors.startTime) setErrors({ ...errors, startTime: false });
            }}
          >
            <option value="" disabled className="bg-midnight text-white/50">Start Time</option>
            {timeOptions.map(t => (
              <option key={t.value} value={t.value} className="bg-midnight">{t.display}</option>
            ))}
          </select>
          <span className="text-white/40 text-sm whitespace-nowrap">to</span>
          <select
            className={selectClass('endTime')}
            value={formData.endTime}
            onChange={e => {
              setFormData({ ...formData, endTime: e.target.value });
              if (errors.endTime) setErrors({ ...errors, endTime: false });
            }}
          >
            <option value="" disabled className="bg-midnight text-white/50">End Time</option>
            {timeOptions.map(t => (
              <option key={t.value} value={t.value} className="bg-midnight">{t.display}</option>
            ))}
          </select>
        </div>

        {/* Event Type */}
        <select
          className={selectClass('eventType')}
          value={formData.eventType}
          onChange={e => {
            setFormData({ ...formData, eventType: e.target.value });
            if (errors.eventType) setErrors({ ...errors, eventType: false });
          }}
        >
          <option value="" disabled className="bg-midnight text-white/50">Select Event Type</option>
          <option value="wedding" className="bg-midnight">Wedding</option>
          <option value="club" className="bg-midnight">Club Night</option>
          <option value="private" className="bg-midnight">Private Party</option>
          <option value="corporate" className="bg-midnight">Corporate Event</option>
          <option value="other" className="bg-midnight">Other</option>
        </select>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-auto w-full py-3 bg-gradient-to-r from-electric to-blue-400 rounded-xl font-bold hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Check Availability'}
        </button>
      </form>
    </GlassCard>
  );
}
