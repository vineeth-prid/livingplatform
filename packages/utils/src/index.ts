export { cn } from './cn';
export * from './format';

/** Debounce a function by `wait` ms. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 250,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Type guard for non-null values (handy in `.filter`). */
export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
