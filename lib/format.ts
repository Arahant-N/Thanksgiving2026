function parseLocalDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

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

  return `${formatter.format(parseLocalDate(checkInDate))} - ${formatter.format(parseLocalDate(checkOutDate))}`;
}

export function formatCompactDateRange(checkInDate: string, checkOutDate: string) {
  const checkIn = parseLocalDate(checkInDate);
  const checkOut = parseLocalDate(checkOutDate);
  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const dayFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric" });

  const startMonth = monthFormatter.format(checkIn);
  const endMonth = monthFormatter.format(checkOut);
  const startDay = dayFormatter.format(checkIn);
  const endDay = dayFormatter.format(checkOut);

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

export function formatStops(stops: "Nonstop" | "1-stop") {
  return stops === "Nonstop" ? "Nonstop" : "1 stop";
}
