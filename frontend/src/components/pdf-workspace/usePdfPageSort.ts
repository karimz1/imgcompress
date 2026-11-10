"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from "react";
import { movePdfPages, type WorkspacePage } from "@/lib/pdfWorkspace";

type Point = { x: number; y: number };
type Slot = Point & { width: number; height: number; id: string };

/** Pointer-following cards, live grid reordering, and animated layout changes. */
export function usePdfPageSort(pages: WorkspacePage[], onChange: (update: (pages: WorkspacePage[]) => WorkspacePage[]) => void, disabled: boolean, selection?: ReadonlySet<string>) {
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const current = useRef({ pages, onChange, disabled, selection });
  current.current = { pages, onChange, disabled, selection };
  const positions = useRef(new Map<string, Point>());
  const animations = useRef(new Map<string, Animation>());
  const cleanup = useRef<(() => void) | null>(null);
  const activeDrag = useRef(0);
  const suppressClick = useRef(false);

  useLayoutEffect(() => {
    const next = new Map<string, Point>();
    gridRef.current?.querySelectorAll<HTMLElement>("[data-page-id]").forEach((element) => {
      const id = element.dataset.pageId!;
      const point = { x: element.offsetLeft, y: element.offsetTop };
      next.set(id, point);
      const previous = positions.current.get(id);
      if (!previous || id === dragged || (previous.x === point.x && previous.y === point.y)) return;
      const running = animations.current.get(id);
      const matrix = getComputedStyle(element).transform;
      const offset = matrix === "none" ? new DOMMatrix() : new DOMMatrix(matrix);
      running?.cancel();
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const animation = element.animate([
        { transform: `translate(${previous.x - point.x + offset.m41}px, ${previous.y - point.y + offset.m42}px)` },
        { transform: "translate(0, 0)" },
      ], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      animations.current.set(id, animation);
      animation.onfinish = () => animations.current.delete(id);
    });
    positions.current = next;
  }, [pages, dragged]);

  useLayoutEffect(() => () => {
    cleanup.current?.();
    animations.current.forEach((animation) => animation.cancel());
  }, []);

  function prepare(element: HTMLElement, id: string, point: Point, touch: boolean) {
    if (current.current.disabled || cleanup.current) return;
    const initialPages = current.current.pages;
    const group = current.current.selection?.has(id) ? new Set(current.current.selection) : new Set([id]);
    const rect = element.getBoundingClientRect();
    let latest = point;
    let ghost: HTMLElement | null = null;
    let frame = 0;
    let timer = 0;
    let active = false;
    let token = 0;
    let slots: Slot[] = [];
    let initialScroll = 0;
    let lastTarget = id;

    const tick = () => {
      if (!ghost) return;
      ghost.style.transform = `translate3d(${latest.x - point.x}px, ${latest.y - point.y}px, 0) scale(1.025)`;
      const scroller = scrollRef.current;
      if (scroller) {
        const view = scroller.getBoundingClientRect();
        const edge = Math.min(60, view.height / 4);
        const distance = latest.y < view.top + edge ? latest.y - view.top - edge
          : latest.y > view.bottom - edge ? latest.y - view.bottom + edge : 0;
        if (distance) scroller.scrollTop += Math.max(-18, Math.min(18, distance * 0.3));
        const scrollDelta = scroller.scrollTop - initialScroll;
        const center = { x: rect.left + latest.x - point.x + rect.width / 2, y: rect.top + latest.y - point.y + rect.height / 2 };
        if (latest.x >= view.left && latest.x <= view.right && latest.y >= view.top - edge && latest.y <= view.bottom + edge) {
          let closest = 0;
          let distance = Infinity;
          slots.forEach((slot, index) => {
            const d = Math.hypot(center.x - slot.x, center.y - (slot.y - scrollDelta));
            if (d < distance) { closest = index; distance = d; }
          });
          const target = slots[closest];
          if (target && target.id !== lastTarget) {
            lastTarget = target.id;
            if (!group.has(target.id)) current.current.onChange((items) => movePdfPages(items, group, target.id));
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const begin = () => {
      if (active) return;
      active = true;
      suppressClick.current = true;
      token = ++activeDrag.current;
      animations.current.forEach((animation) => animation.cancel());
      animations.current.clear();
      slots = Array.from(gridRef.current?.querySelectorAll<HTMLElement>("[data-page-id]") ?? []).map((card) => {
        const bounds = card.getBoundingClientRect();
        return { id: card.dataset.pageId!, x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2, width: bounds.width, height: bounds.height };
      });
      initialScroll = scrollRef.current?.scrollTop ?? 0;
      ghost = element.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-testid");
      ghost.removeAttribute("data-page-id");
      ghost.setAttribute("data-pdf-drag-preview", "true");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      Object.assign(ghost.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", zIndex: "80", pointerEvents: "none", opacity: "0.97", boxShadow: "0 18px 45px rgb(0 0 0 / 0.25)", transition: "none", transformOrigin: "center", willChange: "transform" });
      document.body.appendChild(ghost);
      document.body.style.cursor = "grabbing";
      setDragged(id);
      frame = requestAnimationFrame(tick);
    };

    const detach = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", pointerMove);
      document.removeEventListener("pointerup", pointerEnd);
      document.removeEventListener("pointercancel", cancel);
      document.removeEventListener("touchmove", touchMove);
      document.removeEventListener("touchend", pointerEnd);
      document.removeEventListener("touchcancel", cancel);
      document.removeEventListener("keydown", keyDown, true);
      window.removeEventListener("blur", cancel);
      cleanup.current = null;
      document.body.style.cursor = "";
    };

    const finish = (cancelled = false, immediate = false) => {
      detach();
      if (active) window.setTimeout(() => { suppressClick.current = false; }, 0);
      if (cancelled && active) current.current.onChange(() => initialPages);
      const clone = ghost;
      ghost = null;
      const target = gridRef.current?.querySelector<HTMLElement>(`[data-page-id="${id}"]`);
      if (!clone || !target || immediate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
        clone?.remove();
        if (active && activeDrag.current === token) setDragged(null);
        return;
      }
      const destination = target.getBoundingClientRect();
      const animation = clone.animate([
        { transform: clone.style.transform },
        { transform: `translate3d(${destination.left - rect.left}px, ${destination.top - rect.top}px, 0) scale(1)` },
      ], { duration: 170, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "forwards" });
      const remove = () => { clone.remove(); if (activeDrag.current === token) setDragged(null); };
      animation.onfinish = remove;
      animation.oncancel = remove;
    };
    const cancel = () => finish(true, true);
    const pointerEnd = () => finish();
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
    };
    const pointerMove = (event: PointerEvent) => {
      latest = { x: event.clientX, y: event.clientY };
      if (!active && Math.hypot(latest.x - point.x, latest.y - point.y) >= 6) begin();
      if (active) event.preventDefault();
    };
    const touchMove = (event: TouchEvent) => {
      const finger = event.touches[0];
      if (!finger) return;
      latest = { x: finger.clientX, y: finger.clientY };
      if (!active && Math.hypot(latest.x - point.x, latest.y - point.y) >= 8) { finish(false, true); return; }
      if (active) event.preventDefault();
    };
    document.addEventListener("keydown", keyDown, true);
    window.addEventListener("blur", cancel);
    if (touch) {
      timer = window.setTimeout(begin, 240);
      document.addEventListener("touchmove", touchMove, { passive: false });
      document.addEventListener("touchend", pointerEnd);
      document.addEventListener("touchcancel", cancel);
    } else {
      document.addEventListener("pointermove", pointerMove, { passive: false });
      document.addEventListener("pointerup", pointerEnd);
      document.addEventListener("pointercancel", cancel);
    }
    cleanup.current = () => finish(true, true);
  }

  const interactive = (target: EventTarget) => (target as HTMLElement).closest("button:not([data-pdf-sort-surface]), input, label, a, select");
  return {
    gridRef, scrollRef, dragged,
    isDragging: () => cleanup.current !== null && suppressClick.current,
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); } },
    onPointerDown: (event: ReactPointerEvent<HTMLElement>, id: string) => {
      if (event.pointerType === "touch" || event.button !== 0 || interactive(event.target)) return;
      prepare(event.currentTarget, id, { x: event.clientX, y: event.clientY }, false);
    },
    onTouchStart: (event: ReactTouchEvent<HTMLElement>, id: string) => {
      if (event.touches.length !== 1 || interactive(event.target)) return;
      const finger = event.touches[0];
      prepare(event.currentTarget, id, { x: finger.clientX, y: finger.clientY }, true);
    },
  };
}
