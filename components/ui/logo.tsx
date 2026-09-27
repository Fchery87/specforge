import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
}

const SIZE_MAP = {
  sm: { icon: 'size-6', text: 'text-body' },
  md: { icon: 'size-7', text: 'text-title' },
  lg: { icon: 'size-9', text: 'text-heading' },
  xl: { icon: 'size-12', text: 'text-heading' },
};

/**
 * The SpecForge mark: a section sign on a tile, with a brand dot for the claim it certifies.
 *
 * Drawn inline so the tile follows the theme: ink in light, near-white in dark, with the section
 * sign cut out in the ground colour. ADR 0002.
 */
export function SpecForgeMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-ink" />
      <path
        className="fill-void"
        d="M16.3 7.2c-3 0-5.1 1.6-5.1 3.9 0 1.3.7 2.3 1.8 3-1.4.7-2.2 1.9-2.2 3.3 0 2.5 2.4 3.6 5 4.6 1.9.7 2.8 1.2 2.8 2.1 0 .9-.9 1.5-2.4 1.5-1.6 0-2.8-.7-3.2-2.1l-2.6.8c.6 2.4 2.9 3.8 5.8 3.8 3.1 0 5.2-1.6 5.2-3.9 0-1.3-.7-2.3-1.8-3 1.4-.7 2.2-1.9 2.2-3.3 0-2.5-2.4-3.6-5-4.6-1.9-.7-2.8-1.2-2.8-2.1 0-.9.9-1.5 2.4-1.5 1.5 0 2.6.6 3.1 1.9l2.6-.8c-.7-2.3-2.9-3.6-5.8-3.6zm-1.7 8.2 2.3.9c1.6.6 2.4 1.1 2.4 2 0 .7-.5 1.2-1.3 1.6l-2.3-.9c-1.6-.6-2.4-1.1-2.4-2 0-.7.5-1.2 1.3-1.6z"
      />
      <circle cx="25" cy="7" r="3" className="fill-brand" />
    </svg>
  );
}

export function SpecForgeLogo({ className, size = 'md', showWordmark = true }: LogoProps) {
  const currentSize = SIZE_MAP[size];

  return (
    <div className={cn('flex items-center gap-2.5 select-none', className)}>
      <SpecForgeMark className={currentSize.icon} title={showWordmark ? undefined : 'SpecForge'} />
      {showWordmark && (
        <span className={cn('font-display font-semibold leading-none text-ink', currentSize.text)}>
          SpecForge
        </span>
      )}
    </div>
  );
}
