import { Link } from 'react-router-dom';

// Placeholder until the landing design options (A, B, C) are built
export default function Designs() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4 p-4">
      <p>Design options coming soon</p>
      <Link to="/" className="underline">Back to the home page</Link>
    </div>
  );
}
