/** Signed amounts read at a glance: up is green (good), down is red (bad), zero stays plain. */
export function signTone(n: number): string {
  return n > 0 ? 'text-deli-green' : n < 0 ? 'text-deli-red' : '';
}
