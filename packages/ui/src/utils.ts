import { clsx, type ClassValue } from 'clsx';

/** Merge Tailwind class names with conflict resolution */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
