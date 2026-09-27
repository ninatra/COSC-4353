import { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { burstConfetti } from './components/confetti.js';
import { useMyTicket } from './components/QueueTicket.jsx';
import { useQueues } from './QueueContext.jsx';

// Plays the confetti once, the first time the user sees their ticket served.
export function useCelebration() {
  const { ticket, status } = useMyTicket();
  const { markCelebrated } = useQueues();
  const { user } = useAuth();
  const fired = useRef(false);
  const shouldCelebrate = status === 'served' && !ticket?.celebrated;

  useEffect(() => {
    if (!shouldCelebrate || fired.current) return;
    fired.current = true;
    markCelebrated(user.email);
    setTimeout(() => burstConfetti(document.querySelector('.ticket')), 120);
  }, [shouldCelebrate, markCelebrated, user.email]);
}
