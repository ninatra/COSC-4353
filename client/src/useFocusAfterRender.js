import { useEffect, useState } from 'react';

// Call focusLater('element-id') before a state change; after the next render,
// that element gets focus (or the page heading if it no longer exists).
export function useFocusAfterRender() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(target);
    (el && !el.disabled ? el : document.getElementById('page-title'))?.focus();
    setTarget(null);
  }, [target]);
  return setTarget;
}
