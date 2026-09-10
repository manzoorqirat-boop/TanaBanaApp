import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Phase 4 offline sweep: rather than retrofitting loading/error state
 * on every one of the ~25 screens built in Phases 1-3 (each already
 * has its own, established pattern — see the README), the highest-
 * leverage single change is a global "you're offline" signal at the
 * app-shell level. Screens still show their own request-level errors
 * when a call actually fails; this just tells the person *why* those
 * calls are about to fail, before they start tapping around.
 */
export function useNetworkStatus(): boolean {
  // Starts true (optimistic) so the banner doesn't flash on boot while
  // NetInfo is still determining status (isConnected is briefly null).
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  return isOnline;
}
