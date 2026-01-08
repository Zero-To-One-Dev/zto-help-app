// services/billingDates.service.js
export function formatMMDDYYYY(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}

export function firstDayOfNextMonth(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();

  // Crear explícitamente el 1 del siguiente mes a mediodía (seguro)
  return new Date(year, month + 1, 1, 12, 0, 0, 0);
}

function firstDayOfFollowingMonth(effectiveDate) {
  return new Date(
    effectiveDate.getFullYear(),
    effectiveDate.getMonth() + 1,
    1,
    12, 0, 0, 0
  );
}

export function recurringBillingDate(effectiveDate, daysBefore = 4) {
  const nextActivation = firstDayOfFollowingMonth(effectiveDate);

  // restar N días
  const bill = new Date(nextActivation);
  bill.setDate(bill.getDate() - daysBefore);

  // mantener mediodía para evitar desfases
  bill.setHours(12, 0, 0, 0);

  return bill;
}

