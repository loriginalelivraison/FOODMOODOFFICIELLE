/** Shorten a label for display only; keep the original address in forms and API data. */
export function truncateAddress(value, maxWords = 5) {
  const address = String(value ?? "").trim();
  if (!address) return "";
  const words = address.split(/\s+/u);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : address;
}
