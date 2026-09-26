'use client';

import { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterState {
  status: string[];
  sortBy: 'updatedAt' | 'createdAt' | 'title';
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'title', label: 'Alphabetical' },
];

interface DashboardSearchProps {
  value: string;
  onChange: (value: string) => void;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  totalResults?: number;
}

export function DashboardSearch({
  value,
  onChange,
  filters,
  onFiltersChange,
  totalResults,
}: DashboardSearchProps) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const debouncedOnChange = useCallback(
    debounce((newValue: string) => {
      onChange(newValue);
    }, 300),
    [onChange]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }

  function handleClear() {
    setLocalValue('');
    onChange('');
  }

  function toggleStatus(status: string) {
    const newStatuses = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    onFiltersChange({ ...filters, status: newStatuses });
  }

  function setSortBy(sortBy: FilterState['sortBy']) {
    onFiltersChange({ ...filters, sortBy });
  }

  const activeFilterCount = filters.status.length;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            value={localValue}
            onChange={handleInputChange}
            className="pl-9 pr-9 h-11 bg-raised/30 border-line/50 focus:bg-void transition-colors"
          />
          {localValue && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ink transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="icon"
          className={cn(
            'h-11 w-11 shrink-0 border-line/50',
            (isFiltersOpen || activeFilterCount > 0) && 'border-primary bg-primary/10'
          )}
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        >
          <div className="relative">
            <SlidersHorizontal className="size-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 size-3 rounded-full bg-primary text-caption font-bold text-primary-foreground flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </div>
        </Button>
      </div>

      {isFiltersOpen && (
        <div className="p-4 border border-line/50 bg-raised/20 animate-in fade-in-0 slide-in-from-top-2 duration-(--duration-standard)">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-caption font-bold text-muted-foreground">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => toggleStatus(option.value)}
                    className={cn(
                      'px-3 py-1.5 text-caption font-medium transition-colors border',
                      filters.status.includes(option.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-void text-muted-foreground border-line hover:border-muted-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-caption font-bold text-muted-foreground">
                Sort By
              </label>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortBy(option.value as FilterState['sortBy'])}
                    className={cn(
                      'px-3 py-1.5 text-caption font-medium transition-colors border',
                      filters.sortBy === option.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-void text-muted-foreground border-line hover:border-muted-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => onFiltersChange({ ...filters, status: [] })}
                className="text-caption text-muted-foreground hover:text-ink transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {totalResults !== undefined && (
        <div className="text-caption text-muted-foreground">
          {totalResults} {totalResults === 1 ? 'project' : 'projects'} found
        </div>
      )}
    </div>
  );
}

function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}
