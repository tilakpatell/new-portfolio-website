import { useEffect } from 'react';
import { sayVoiced, stopVoiced } from './voiced';

// Say a conversation's line in its speaker's voice while it's up (lib/voiced.js):
// a new line stops the last, and so does the conversation closing.
export function useVoiced(who, text) {
  useEffect(() => {
    if (!who || !text) return undefined;
    sayVoiced(who, text);
    return stopVoiced;
  }, [who, text]);
}
