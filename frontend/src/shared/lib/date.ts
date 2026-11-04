export function formatDateBasedOnToday(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  // Convert both dates to local date only (ignore time)
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    // Format as "10:15AM"
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } else {
    // Format as "2025/05/05"
    return date.toLocaleDateString("en-CA").replace(/-/g, "/");
  }
}

export function localDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatMessageDay(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" as const }
      : {}),
  });
}

export function localMonthRange(month: string) {
  const [year, index] = month.split("-").map(Number);
  return {
    from: new Date(year, index - 1, 1).toISOString(),
    to: new Date(year, index, 1).toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
