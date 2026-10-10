export const MIN_COURSE_PRICE_DZD = 100;
export const PRICE_ADJUSTMENT_DZD = 50;

export function adjustCoursePrice(currentValue, fallbackPrice, amount) {
  const currentPrice = Number(currentValue || fallbackPrice || MIN_COURSE_PRICE_DZD);
  return String(Math.max(MIN_COURSE_PRICE_DZD, currentPrice + amount));
}
