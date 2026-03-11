"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const trigger = triggerRef.current.getBoundingClientRect();
      const tooltip = tooltipRef.current.getBoundingClientRect();

      let x = 0;
      let y = 0;

      switch (position) {
        case "top":
          x = trigger.left + trigger.width / 2 - tooltip.width / 2;
          y = trigger.top - tooltip.height - 8;
          break;
        case "bottom":
          x = trigger.left + trigger.width / 2 - tooltip.width / 2;
          y = trigger.bottom + 8;
          break;
        case "left":
          x = trigger.left - tooltip.width - 8;
          y = trigger.top + trigger.height / 2 - tooltip.height / 2;
          break;
        case "right":
          x = trigger.right + 8;
          y = trigger.top + trigger.height / 2 - tooltip.height / 2;
          break;
      }

      // Keep tooltip within viewport
      x = Math.max(8, Math.min(x, window.innerWidth - tooltip.width - 8));
      y = Math.max(8, Math.min(y, window.innerHeight - tooltip.height - 8));

      setCoords({ x, y });
    } else if (!isVisible) {
      setCoords(null);
    }
  }, [isVisible, position]);

  const tooltipElement = isVisible ? (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] px-2.5 py-1.5 text-xs bg-background-elevated border border-border rounded-lg shadow-lg max-w-xs"
      style={{
        left: coords?.x ?? -9999,
        top: coords?.y ?? -9999,
        visibility: coords ? "visible" : "hidden",
      }}
    >
      <div className="text-text-secondary whitespace-normal">{content}</div>
    </div>
  ) : null;

  return (
    <div
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {mounted && tooltipElement && createPortal(tooltipElement, document.body)}
    </div>
  );
}

// Simple info icon with tooltip
export function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip content={content}>
      <span className="inline-flex items-center justify-center w-4 h-4 text-text-muted hover:text-text-secondary cursor-help transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </span>
    </Tooltip>
  );
}
