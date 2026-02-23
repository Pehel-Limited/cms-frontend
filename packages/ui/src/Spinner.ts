import React from 'react';
import { cn } from './utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return React.createElement('div', {
    className: cn(
      'animate-spin rounded-full border-2 border-current border-t-transparent',
      SIZE_CLASSES[size],
      className
    ),
    role: 'status',
    'aria-label': 'Loading',
  });
}
