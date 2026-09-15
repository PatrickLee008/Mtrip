const KEY = 'mtrip:selected-property-id';

export function getSelectedPropertyId(): number | null {
  const value = Number(sessionStorage.getItem(KEY));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function setSelectedPropertyId(value: number | null): void {
  if (value === null) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, String(value));
}
