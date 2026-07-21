import { useEffect } from 'react';

// Sprint A4 — Profile polish. Shows the browser's native "leave site?"
// confirmation when `isDirty` is true and the user tries to close the
// tab or refresh/navigate away at the browser level.
//
// Scope note: this app uses <BrowserRouter> (App.tsx), not a data
// router, so react-router's useBlocker/usePrompt (which require a data
// router) aren't available here — in-app link clicks (Sidebar/Topbar)
// can't be intercepted without that migration, which is out of scope
// for this sprint ("no new architecture"). This hook still covers the
// most damaging case (accidental tab close / refresh with unsaved
// changes) and is written so it's a drop-in call site once/if the app
// moves to createBrowserRouter later.
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Chrome requires returnValue to be set; the string itself is
      // ignored by modern browsers in favor of a generic native message.
      e.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
