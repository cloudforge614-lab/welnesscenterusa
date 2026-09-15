"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Native <dialog> gives focus trapping, Escape-to-close and inert background for free.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop open:animate-fade-up"
    >
      <div className="p-6 sm:p-7">
        <h2 id="modal-title" className="font-display text-2xl text-ink">
          {title}
        </h2>
        {description && <div className="mt-1.5 text-sm text-ink-muted">{description}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </dialog>
  );
}
