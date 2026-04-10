/**
 * Responsive viewport utilities for AegisRange.
 *
 * Breakpoints (aligned with Tailwind defaults):
 *   - mobile:  < 768px   (Tailwind: default / sm)
 *   - tablet:  768–1023px (Tailwind: md)
 *   - desktop: >= 1024px  (Tailwind: lg+)
 *
 * Usage:
 *   const { isMobile, isTablet, isDesktop } = useViewport();
 *
 * SSR-safe: defaults to desktop during server-side rendering to avoid
 * layout flicker on the most common viewport. The first client-side
 * effect corrects the value immediately.
 *
 * To make mobile-only, tablet-only, or desktop-only edits:
 *   - CSS-first: use Tailwind's responsive prefixes (md:, lg:)
 *   - JS-first:  use the useViewport() hook for conditional rendering
 *   - Component: use <ResponsiveView mobile={...} tablet={...} desktop={...} />
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

/** Canonical breakpoint thresholds in pixels. */
export const BREAKPOINTS = {
  /** Below this is mobile. */
  tablet: 768,
  /** At or above this is desktop. */
  desktop: 1024,
} as const;

/** Screen class enum for conditional logic. */
export type ScreenType = 'mobile' | 'tablet' | 'desktop';

export interface ViewportState {
  /** True when viewport width < 768px. */
  isMobile: boolean;
  /** True when viewport width is 768–1023px. */
  isTablet: boolean;
  /** True when viewport width >= 1024px. */
  isDesktop: boolean;
  /** Current screen class as a string. */
  screenType: ScreenType;
}

function getScreenType(width: number): ScreenType {
  if (width < BREAKPOINTS.tablet) return 'mobile';
  if (width < BREAKPOINTS.desktop) return 'tablet';
  return 'desktop';
}

function buildState(screenType: ScreenType): ViewportState {
  return {
    isMobile: screenType === 'mobile',
    isTablet: screenType === 'tablet',
    isDesktop: screenType === 'desktop',
    screenType,
  };
}

/**
 * SSR-safe viewport hook.
 *
 * Returns stable booleans and a screenType string that update
 * on window resize via matchMedia listeners (no resize polling).
 */
export function useViewport(): ViewportState {
  const [state, setState] = useState<ViewportState>(() => buildState('desktop'));

  const update = useCallback(() => {
    setState(buildState(getScreenType(window.innerWidth)));
  }, []);

  useEffect(() => {
    // Correct SSR default on mount
    update();

    const mqTablet = window.matchMedia(`(min-width: ${BREAKPOINTS.tablet}px)`);
    const mqDesktop = window.matchMedia(`(min-width: ${BREAKPOINTS.desktop}px)`);

    const handler = () => update();
    mqTablet.addEventListener('change', handler);
    mqDesktop.addEventListener('change', handler);

    return () => {
      mqTablet.removeEventListener('change', handler);
      mqDesktop.removeEventListener('change', handler);
    };
  }, [update]);

  return state;
}
