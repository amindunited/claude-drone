export function getElementValue(id: string): string {
  const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  return element?.value || '';
}

export function getElementNumericValue(id: string): number {
  const value = getElementValue(id);
  return parseFloat(value) || 0;
}

export function updateValueDisplay(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

export function formatFrequency(value: number): string {
  return `${value} Hz`;
}

export function formatDecimal(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

export function formatTime(value: number): string {
  return `${value.toFixed(2)} s`;
}

export function disableButton(id: string): void {
  const button = document.getElementById(id) as HTMLButtonElement;
  if (button) {
    button.disabled = true;
  }
}

export function enableButton(id: string): void {
  const button = document.getElementById(id) as HTMLButtonElement;
  if (button) {
    button.disabled = false;
  }
}

export function addEventListeners(
  elementIds: string[], 
  event: string, 
  callback: (id: string, value: string) => void
): void {
  elementIds.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener(event, (e) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        callback(id, target.value);
      });
    }
  });
}
