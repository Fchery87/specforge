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
  sm: { icon: 'w-6 h-6', img: 24, text: 'text-lg', badge: 'text-[9px]' },
  md: { icon: 'w-8 h-8', img: 32, text: 'text-2xl', badge: 'text-[10px]' },
  lg: { icon: 'w-10 h-10', img: 40, text: 'text-3xl', badge: 'text-xs' },
  xl: { icon: 'w-14 h-14', img: 56, text: 'text-4xl', badge: 'text-xs' },
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
    <div className={cn('flex items-center gap-2.5 group select-none', className)}>
      {/* Brand Icon Mark */}
      <div
        className={cn(
          'relative flex items-center justify-center shrink-0 overflow-hidden',
          'border border-primary/40 bg-black',
          'group-hover:border-primary group-hover:shadow-[0_0_12px_rgba(223,225,4,0.35)]',
          'transition-all duration-300',
          currentSize.icon
        )}
      >
        {variant === 'emblem' ? (
          <Image
            src="/specforge-logo-emblem.jpg"
            alt="SpecForge Mark"
            width={currentSize.img}
            height={currentSize.img}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            priority
          />
        ) : (
          <svg
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full p-1 text-primary"
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
            'font-black uppercase tracking-tighter leading-none text-foreground transition-colors',
            currentSize.text
          )}
        >
          Spec<span className="text-primary group-hover:drop-shadow-[0_0_8px_rgba(223,225,4,0.4)]">Forge</span>
        </span>
      )}
    </div>
  );
}
