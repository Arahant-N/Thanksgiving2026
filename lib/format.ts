export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(value);
}

export function formatDateRange(checkInDate: string, checkOutDate: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  });

  return `${formatter.format(new Date(checkInDate))} - ${formatter.format(new Date(checkOutDate))}`;
}

export function formatStops(stops: "Nonstop" | "1-stop") {
  return stops === "Nonstop" ? "Nonstop" : "1 stop";
}
