export default function TestimonialsPage({ onBack }) {
    return (
        <div className="min-h-screen bg-midnight p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="mb-8 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl font-semibold transition-all border border-white/20 flex items-center gap-2"
                >
                    ← Back to Home
                </button>

                <h1 className="text-4xl font-black text-electric mb-8 text-center">Testimonials</h1>

                {/* Featured Testimonial - Mac Miller */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
                    <h2 className="text-3xl font-bold text-white mb-6 text-center">Mac Miller</h2>
                    <div className="flex justify-center mb-6">
                        <img
                            src="/assets/celeb-photo.png"
                            alt="Mac Miller"
                            className="max-w-full h-auto rounded-xl border border-white/20 max-h-[500px] object-contain"
                        />
                    </div>
                    <p className="text-white/80 text-lg italic text-center">
                        "DJ Insanity sold me the shit that killed me man - Mac Miller"
                    </p>
                </div>
            </div>
        </div>
    );
}
