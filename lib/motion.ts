/**
 * Motion Design Tokens for SpecForge
 * Consistent animation presets across the application
 */

import { type Transition, type Variants } from 'framer-motion';

// === Transition Presets ===
export const transitions = {
  fast: { duration: 0.15, ease: 'easeOut' } as Transition,
  medium: { duration: 0.3, ease: 'easeOut' } as Transition,
  slow: { duration: 0.5, ease: 'easeOut' } as Transition,
  bounce: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
  smooth: { type: 'spring', stiffness: 100, damping: 20 } as Transition,
};

// === Fade Variants ===
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.medium },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: transitions.medium },
};

export const fadeInDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0, transition: transitions.medium },
};

// === Scale Variants ===
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: transitions.bounce },
};

export const pressable: Variants = {
  idle: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

// === Stagger Container ===
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: transitions.medium },
};

// === Slide Variants ===
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: transitions.medium },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: transitions.medium },
};

// === Card Hover ===
export const cardHover: Variants = {
  idle: {
    borderColor: 'var(--border)',
    backgroundColor: 'var(--card)',
  },
  hover: {
    borderColor: 'var(--primary)',
    transition: transitions.fast,
  },
};

// === Loading States ===
export const pulse: Variants = {
  animate: {
    opacity: [0.4, 0.7, 0.4],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// === Page Transitions ===
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: transitions.medium },
  exit: { opacity: 0, y: -20, transition: transitions.fast },
};
