// lib/hooks/useDebounce.ts
// Debounce hook for delaying value updates

import { useState, useEffect } from "react";

/**
 * Debounces a value by the specified delay.
 * Useful for delaying expensive operations like API calls while typing.
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState("");
 * const debouncedSearchTerm = useDebounce(searchTerm, 300);
 * 
 * // Use debouncedSearchTerm for API calls
 * useEffect(() => {
 *   if (debouncedSearchTerm) {
 *     searchAPI(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
