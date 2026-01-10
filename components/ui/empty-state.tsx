"use client";

import { ReactNode } from "react";
import { LucideIcon, FileQuestion, Inbox, Search, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateVariant = "default" | "search" | "folder" | "inbox";

interface EmptyStateProps {
  icon?: LucideIcon;
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

const variantIcons: Record<EmptyStateVariant, LucideIcon> = {
  default: FileQuestion,
  search: Search,
  folder: FolderOpen,
  inbox: Inbox,
};

export function EmptyState({
  icon,
  variant = "default",
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  const IconComponent = icon || variantIcons[variant];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-8",
        className
      )}
    >
      {/* Icon with decorative border */}
      <div className="relative mb-6">
        <div className="w-20 h-20 border-2 border-border flex items-center justify-center bg-secondary/30">
          <IconComponent className="w-10 h-10 text-muted-foreground" />
        </div>
        {/* Decorative corner accents */}
        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />
      </div>

      {/* Title */}
      <h3 className="text-2xl font-bold uppercase tracking-tighter mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Custom content */}
      {children}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          {action && (
            <Button onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
