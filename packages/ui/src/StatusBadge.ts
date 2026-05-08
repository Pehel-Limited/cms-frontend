import React from 'react';
import { cn } from './utils';

export interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  // Positive
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
  BOOKED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  DISBURSED: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  // Negative
  DECLINED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  WITHDRAWN: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  // In-progress
  SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  VERIFICATION: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  UNDER_REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  OFFER: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  SIGNING: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  BOOKING: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' },
};

const DEFAULT_COLORS = { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-400' };

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function StatusBadge({ status, label, size = 'md', className }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] || DEFAULT_COLORS;
  const displayLabel = label || status.replace(/_/g, ' ');

  return React.createElement(
    'span',
    {
      className: cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        colors.bg,
        colors.text,
        SIZE_CLASSES[size],
        className
      ),
    },
    React.createElement('span', {
      className: cn('inline-block h-1.5 w-1.5 rounded-full', colors.dot),
    }),
    displayLabel
  );
}
