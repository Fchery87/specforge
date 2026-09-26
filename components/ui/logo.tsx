'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  variant?: 'emblem' | 'vector';
}

const SIZE_MAP = {
  sm: { icon: 'size-6', img: 24, text: 'text-ui' },
  md: { icon: 'size-8', img: 32, text: 'text-title' },
  lg: { icon: 'size-10', img: 40, text: 'text-heading' },
  xl: { icon: 'size-14', img: 56, text: 'text-heading' },
};

/**
 * Modern SpecForge brand logo mark as of late 2026.
 * Features the precision isometric forge emblem and technical wordmark.
 */
export function SpecForgeLogo({
  className,
  size = 'md',
  showWordmark = true,
  variant = 'emblem',
}: LogoProps) {
  const currentSize = SIZE_MAP[size];

  return (
    <div className={cn('flex items-center gap-2 group select-none', className)}>
      {/* Brand Icon Mark */}
      <div
        className={cn(
          'relative flex items-center justify-center shrink-0 overflow-hidden rounded-sm',
          'border border-line bg-void',
          'group-hover:border-primary',
          'transition-colors duration-(--duration-standard)',
          currentSize.icon
        )}
      >
        {variant === 'emblem' ? (
          <Image
            src="/specforge-logo-emblem.jpg"
            alt="SpecForge Mark"
            width={currentSize.img}
            height={currentSize.img}
            className="h-full w-full object-cover"
            priority
          />
        ) : (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full p-1 text-primary"
            aria-hidden="true"
          >
            {/* Isometric Anvil & Digital Forge Geometry */}
            <path
              d="M16 3L26 8.5V14.5L16 20L6 14.5V8.5L16 3Z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
            <path
              d="M16 20V28M6 14.5L16 9.5L26 14.5M16 9.5V3"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 23.5H22M8 28H24"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Brand Wordmark */}
      {showWordmark && (
        <span
          className={cn(
            'font-semibold leading-none text-ink',
            currentSize.text
          )}
        >
          Spec<span className="text-primary">Forge</span>
        </span>
      )}
    </div>
  );
}
