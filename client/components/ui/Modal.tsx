import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  ariaLabelledBy?: string;
}

export function Modal({ open, onClose, children, className, ariaLabelledBy }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Keep the overlay inside the visible viewport (soft keyboard / mobile chrome). */
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;

    const root = document.documentElement;
    const vv = window.visualViewport;

    const sync = () => {
      const height = vv?.height ?? window.innerHeight;
      const width = vv?.width ?? window.innerWidth;
      const offsetTop = vv?.offsetTop ?? 0;
      const offsetLeft = vv?.offsetLeft ?? 0;
      root.style.setProperty('--modal-vv-height', `${Math.round(height)}px`);
      root.style.setProperty('--modal-vv-width', `${Math.round(width)}px`);
      root.style.setProperty('--modal-vv-top', `${Math.round(offsetTop)}px`);
      root.style.setProperty('--modal-vv-left', `${Math.round(offsetLeft)}px`);
    };

    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);

    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      root.style.removeProperty('--modal-vv-height');
      root.style.removeProperty('--modal-vv-width');
      root.style.removeProperty('--modal-vv-top');
      root.style.removeProperty('--modal-vv-left');
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousActiveElement = document.activeElement;
    const modalElement = modalRef.current;
    if (!modalElement) {
      return undefined;
    }

    const focusableSelector =
      'a[href]:not([tabindex="-1"]), area[href]:not([tabindex="-1"]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [contenteditable="true"]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

    const getFocusableElements = () =>
      Array.from(modalElement.querySelectorAll<HTMLElement>(focusableSelector));

    const initialFocusable = getFocusableElements();
    if (initialFocusable.length > 0) {
      initialFocusable[0].focus();
    } else {
      modalElement.focus();
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !modalElement.contains(target)) return;
      // Keep focused fields visible above the soft keyboard.
      requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        modalElement.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (
          !activeElement ||
          activeElement === firstElement ||
          !modalElement.contains(activeElement)
        ) {
          event.preventDefault();
          lastElement.focus();
        }
        return;
      }

      if (
        !activeElement ||
        activeElement === lastElement ||
        !modalElement.contains(activeElement)
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      if (
        previousActiveElement instanceof HTMLElement &&
        document.contains(previousActiveElement) &&
        previousActiveElement !== document.body &&
        !previousActiveElement.hasAttribute('disabled')
      ) {
        previousActiveElement.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined' || !document.body) {
      return undefined;
    }

    const body = document.body;
    const currentCount = Number(body.dataset.modalOpenCount ?? '0');
    const nextCount = Number.isFinite(currentCount) ? currentCount + 1 : 1;
    body.dataset.modalOpenCount = String(nextCount);
    body.classList.add('modal-open');

    return () => {
      const activeCount = Number(body.dataset.modalOpenCount ?? '1');
      const decremented = Number.isFinite(activeCount) ? Math.max(0, activeCount - 1) : 0;

      if (decremented === 0) {
        delete body.dataset.modalOpenCount;
        body.classList.remove('modal-open');
      } else {
        body.dataset.modalOpenCount = String(decremented);
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const modalClassName = className ? `modal ${className}` : 'modal';

  const stopPropagation = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const modalContent = (
    <div className="modal-overlay active" onClick={onClose}>
      <div
        ref={modalRef}
        className={modalClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onClick={stopPropagation}
      >
        {children}
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined' || !document.body) {
    return null;
  }

  return createPortal(modalContent, document.body);
}
