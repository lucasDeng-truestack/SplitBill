export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? name;
}

export function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function tableTitle(iso: string, now = new Date()): string {
  const created = new Date(iso);
  const zone = "Asia/Kuala_Lumpur";
  const dayKey = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

  if (dayKey(created) === dayKey(now)) return "Today’s table";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(created) === dayKey(yesterday)) return "Last night’s table";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(created);
}

export function tableDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}
