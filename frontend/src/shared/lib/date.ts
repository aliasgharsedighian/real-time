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
