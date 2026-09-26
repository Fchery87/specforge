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
        "flex flex-col items-center justify-center rounded-lg border border-line bg-surface px-8 py-16 text-center",
        className
      )}
    >
      <div className="mb-6 flex size-12 items-center justify-center rounded-sm border border-line bg-raised">
        <IconComponent className="size-6 text-dim" />
      </div>

      <h3 className="text-title font-semibold text-ink mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-ui text-muted-foreground max-w-md mb-6">
          {description}
        </p>
      )}

      {children}

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
