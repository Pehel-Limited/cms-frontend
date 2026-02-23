'use client';

import React from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: SortConfig;
  onSort: (field: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  className = '',
  align = 'left',
}: SortableHeaderProps) {
  const isActive = currentSort.field === field;
  const textAlign =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  return (
    <th
      className={`px-6 py-3 ${textAlign} text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        <span>{label}</span>
        <span className="flex flex-col">
          <svg
            className={`w-3 h-3 -mb-0.5 ${isActive && currentSort.direction === 'asc' ? 'text-blue-600' : 'text-gray-300'}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 0L10 6H0L5 0Z" />
          </svg>
          <svg
            className={`w-3 h-3 -mt-0.5 ${isActive && currentSort.direction === 'desc' ? 'text-blue-600' : 'text-gray-300'}`}
            viewBox="0 0 10 6"
            fill="currentColor"
          >
            <path d="M5 6L0 0H10L5 6Z" />
          </svg>
        </span>
      </div>
    </th>
  );
}

/**
 * Hook for managing sort state.
 * Usage: const { sortConfig, handleSort, sortData } = useSort('createdAt');
 */
export function handleSortToggle(field: string, currentSort: SortConfig): SortConfig {
  if (currentSort.field === field) {
    // Cycle: asc -> desc -> null
    if (currentSort.direction === 'asc') return { field, direction: 'desc' };
    if (currentSort.direction === 'desc') return { field: '', direction: null };
  }
  return { field, direction: 'asc' };
}

/**
 * Generic client-side sort function for arrays.
 * Supports string, number, boolean, and date-like values.
 */
export function sortData<T>(data: T[], sortConfig: SortConfig): T[] {
  if (!sortConfig.field || !sortConfig.direction) return data;

  return [...data].sort((a, b) => {
    const aVal = getNestedValue(a, sortConfig.field);
    const bVal = getNestedValue(b, sortConfig.field);

    // Handle nulls
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortConfig.direction === 'asc' ? -1 : 1;
    if (bVal == null) return sortConfig.direction === 'asc' ? 1 : -1;

    let comparison = 0;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
      comparison = (aVal ? 1 : 0) - (bVal ? 1 : 0);
    } else {
      comparison = String(aVal).localeCompare(String(bVal), undefined, { sensitivity: 'base' });
    }

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
