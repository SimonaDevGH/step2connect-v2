// ─── LivePerson Integration ────────────────────────────────────────────────────
// The lpTag monitoring script is loaded in index.html (site: 91669831).
// This component notifies LP of SPA route changes via lpTag.newPage() so that
// engagement rules (configured in LP Campaigns) can react to page navigation.
// LP renders and controls its own chat button/window entirely.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function LivePersonBubble() {
  const location = useLocation();

  useEffect(() => {
    try {
      window.lpTag?.newPage?.(document.title, window.location.href);
    } catch (e) {
      // LP not loaded (e.g. blocked by adblocker) — silently ignore
    }
  }, [location.pathname]);

  // Renders nothing — LP injects its own DOM
  return null;
}
