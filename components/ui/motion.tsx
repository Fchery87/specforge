"use client";

import { motion, MotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MotionDivProps extends MotionProps {
  children?: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function MotionDiv({
  children,
  className,
  delay = 0,
  duration = 0.5,
  ...props
}: MotionDivProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionFadeIn({
  children,
  className,
  delay = 0,
  duration = 0.5,
  ...props
}: MotionDivProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionScale({
  children,
  className,
  delay = 0,
  duration = 0.3,
  ...props
}: MotionDivProps) {
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionSlideIn({
  children,
  className,
  direction = "left",
  delay = 0,
  duration = 0.5,
  ...props
}: MotionDivProps & {
  direction?: "left" | "right" | "up" | "down";
}) {
  const offset = direction === "left" || direction === "right" ? 50 : 25;
  const xOffset = direction === "left" ? -offset : direction === "right" ? offset : 0;
  const yOffset = direction === "up" ? offset : direction === "down" ? -offset : 0;

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, x: xOffset, y: yOffset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionStagger({
  children,
  className,
  staggerDelay = 0.1,
  ...props
}: MotionDivProps & { staggerDelay?: number }) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function MotionItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Hover and tap animations for interactive elements
export function MotionButton({
  children,
  className,
  ...props
}: MotionDivProps) {
  return (
    <motion.button
      className={cn(className)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// Scroll reveal animation hook
export function useScrollReveal() {
  return {
    initial: { opacity: 0, y: 30 },
    whileInView: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
    viewport: { once: true, margin: "-50px" },
  };
}
