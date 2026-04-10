/**
 * Render different content for mobile, tablet, and desktop viewports.
 *
 * Usage:
 *   <ResponsiveView
 *     mobile={<MobileLayout />}
 *     tablet={<TabletLayout />}
 *     desktop={<DesktopLayout />}
 *   />
 *
 * All three props are optional. If a prop is omitted the component
 * falls back in order: tablet -> desktop, mobile -> tablet -> desktop.
 */

'use client';

import { ReactNode } from 'react';
import { useViewport } from '@/lib/responsive';

interface ResponsiveViewProps {
  mobile?: ReactNode;
  tablet?: ReactNode;
  desktop?: ReactNode;
}

export default function ResponsiveView({ mobile, tablet, desktop }: ResponsiveViewProps) {
  const { screenType } = useViewport();

  switch (screenType) {
    case 'mobile':
      return <>{mobile ?? tablet ?? desktop ?? null}</>;
    case 'tablet':
      return <>{tablet ?? desktop ?? null}</>;
    case 'desktop':
      return <>{desktop ?? null}</>;
  }
}
