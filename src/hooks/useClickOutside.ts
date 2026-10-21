import { useEffect, useRef } from 'react';

/**
 * Close a dropdown/popover when the user clicks outside of it.
 *
 * Attach the returned ref to the wrapper element that contains BOTH the
 * trigger (button) and the floating menu, so clicking the trigger still
 * toggles the menu instead of immediately closing it.
 *
 * @param onOutsideClick Callback fired when a pointer-down lands outside the ref.
 * @param active When false the listener is detached (use while the menu is closed).
 */
export function useClickOutside<T extends HTMLElement = HTMLDivElement>(
  onOutsideClick: () => void,
  active: boolean = true,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onOutsideClick, active]);

  return ref;
}
