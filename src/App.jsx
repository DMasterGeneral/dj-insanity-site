import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import './index.css';

const Classic = lazy(() => import('./pages/landing/Classic'));
const Designs = lazy(() => import('./pages/landing/Designs'));
const RequestPage = lazy(() => import('./pages/request/RequestPage'));
const Thanks = lazy(() => import('./pages/request/Thanks'));
const Dashboard = lazy(() => import('./pages/dj/Dashboard'));
const IntroOverlay = lazy(() => import('./intro/IntroOverlay'));

function isLandingPath(pathname) {
  return pathname === '/' || pathname === '/classic' || pathname.startsWith('/designs/');
}

function Loading() {
  return <div style={{ minHeight: '100vh', background: '#050505' }} />;
}

function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center gap-4 p-4">
      <p>Page not found.</p>
      <Link to="/" className="underline">Go to the home page</Link>
    </div>
  );
}

function AppContent() {
  const { pathname } = useLocation();
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Classic />} />
          <Route path="/classic" element={<Classic />} />
          <Route path="/designs/:design" element={<Designs />} />
          <Route path="/request" element={<RequestPage />} />
          <Route path="/request/thanks" element={<Thanks />} />
          <Route path="/payment-success" element={<Thanks />} />
          <Route path="/dj" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {isLandingPath(pathname) && (
        <Suspense fallback={null}>
          <IntroOverlay />
        </Suspense>
      )}
    </>
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
