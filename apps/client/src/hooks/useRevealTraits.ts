import { useEffect, useState } from 'react';

/**
 * Признаки всех жителей разом: пока зажат Alt — или пока включена кнопка в шапке.
 * Раньше приходилось наводиться на каждый жетон по очереди.
 */
export function useRevealTraits(): { reveal: boolean; locked: boolean; toggle: () => void } {
  const [held, setHeld] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      // иначе браузер (и Electron) уводит фокус в меню окна
      e.preventDefault();
      setHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      e.preventDefault();
      setHeld(false);
    };
    // Alt+Tab: keyup уйдёт в другое окно, и признаки залипнут
    const release = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, []);

  return { reveal: held || locked, locked, toggle: () => setLocked(v => !v) };
}
