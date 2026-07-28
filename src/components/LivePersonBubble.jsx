// ─── LivePerson Integration ────────────────────────────────────────────────────
// The lpTag monitoring script is loaded in index.html (site: 91669831).
// This component:
//   1. Notifies LP of SPA route changes via lpTag.newPage()
//   2. Opens/closes the LP unified chat window when triggered from the bottom bar
//
// LP renders its own chat UI; this component owns only the trigger logic.
// To hide LP's native floating button (if you want the bottom-bar button to be
// the sole entry point), set lpButtonDiv visibility via LP Admin > Engagement
// settings, or add:  #lpButtonDiv { display: none !important; }  to index.css
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Safe wrappers — guard against LP not yet loaded or blocked by adblocker
function lpNewPage() {
  try {
    window.lpTag?.newPage?.(document.title, window.location.href);
  } catch (e) {
    console.debug('[LP] newPage error', e);
  }
}

function lpOpenChat() {
  try {
    // Preferred: trigger the unified window open event
    window.lpTag?.events?.trigger?.('lpUnifiedWindow', 'open');
    // Fallback: click LP's own button if the event API isn't available yet
    if (!window.lpTag?.events) {
      document.querySelector('#lpButtonDiv a, .LPMcontainer')?.click();
    }
  } catch (e) {
    console.debug('[LP] openChat error', e);
  }
}

function lpCloseChat() {
  try {
    window.lpTag?.events?.trigger?.('lpUnifiedWindow', 'close');
  } catch (e) {
    console.debug('[LP] closeChat error', e);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LivePersonBubble({ open, onClose }) {
  const location = useLocation();

  // Notify LP whenever the SPA navigates to a new page
  useEffect(() => {
    lpNewPage();
  }, [location.pathname]);

  // Open / close the LP chat window when the bottom-bar button is tapped
  useEffect(() => {
    if (open) {
      lpOpenChat();
      // LP fires its own close event; mirror it back to our state
      const handler = () => onClose?.();
      window.lpTag?.events?.bind?.('lpUnifiedWindow', 'conversationEnd', handler);
      window.lpTag?.events?.bind?.('lpUnifiedWindow', 'close', handler);
      return () => {
        // LP event API doesn't expose unbind in all versions — no-op if missing
      };
    } else {
      lpCloseChat();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // This component renders nothing — LP injects its own DOM
  return null;
}
