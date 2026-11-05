"use client";

import { useEffect, useRef, type RefObject } from "react";

const overlayStack: symbol[] = [];
let originalBodyOverflow = "";

/** Keeps the active modal keyboard-accessible and returns focus on dismissal. */
export function useOverlayFocus(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const tokenRef = useRef(Symbol("notez-overlay"));

  useEffect(() => {
    if (!active) return;
    const token = tokenRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (overlayStack.length === 0) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    overlayStack.push(token);

    const focusable = () => {
      const container = containerRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
    };

    const frame = requestAnimationFrame(() => {
      const target = initialFocusRef?.current || focusable()[0] || containerRef.current;
      target?.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }
      const current = document.activeElement;
      const index = items.indexOf(current as HTMLElement);
      if (event.shiftKey && index <= 0) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && (index === -1 || index === items.length - 1)) {
        event.preventDefault();
        items[0].focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      const index = overlayStack.lastIndexOf(token);
      if (index >= 0) overlayStack.splice(index, 1);
      if (overlayStack.length === 0) document.body.style.overflow = originalBodyOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, containerRef, initialFocusRef]);
}
