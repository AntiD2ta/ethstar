import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a star count for compact display on repo cards (e.g. "1.5k", "142k").
 * Uses single-letter suffix and one decimal place.
 */
export function formatStarCount(count: number): string {
  if (count >= 1000) {
    const tenths = Math.round(count / 100);
    const whole = Math.floor(tenths / 10);
    const remainder = tenths % 10;
    return remainder === 0 ? `${whole}k` : `${whole}.${remainder}k`;
  }
  return count.toString();
}

/**
 * Format a combined star total for the hero ribbon (e.g. "142,000+").
 * Floors to the nearest thousand so the trailing "+" is always truthful
 * (a count of 1,999 must not display as "2,000+").
 */
export function formatHeroStars(count: number): string {
  if (count >= 1000) {
    const k = Math.floor(count / 1000);
    return `${k.toLocaleString()},000+`;
  }
  return count.toString();
}
