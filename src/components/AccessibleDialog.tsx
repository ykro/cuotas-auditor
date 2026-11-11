import { useEffect, useRef, type ReactNode } from 'react';

export function AccessibleDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="feedback-dialog" aria-label="Tu opinión" onCancel={e => { e.preventDefault(); close.current(); }} onClick={e => { if (e.target === e.currentTarget) close.current(); }}>{children}</dialog>;
}
