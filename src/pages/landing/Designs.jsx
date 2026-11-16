import { lazy, Suspense, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import DesignSwitcher from './DesignSwitcher.jsx';

// /designs/:design: one of the candidate landing designs (plan section 4.7), plus the floating switcher.
const DESIGNS = {
  a: lazy(() => import('./designs/a/index.jsx')),
  b: lazy(() => import('./designs/b/index.jsx')),
  c: lazy(() => import('./designs/c/index.jsx')),
};

export default function Designs() {
  const { design } = useParams();
  const known = Object.hasOwn(DESIGNS, design);

  useEffect(() => {
    // A newly picked design starts at the top unless the address targets a section (#book…).
    if (known && !window.location.hash) window.scrollTo(0, 0);
  }, [design, known]);

  if (!known) return <Navigate to="/designs/a" replace />;
  const Design = DESIGNS[design];

  return (
    <>
      <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
        <Design />
      </Suspense>
      <DesignSwitcher current={design} />
    </>
  );
}
