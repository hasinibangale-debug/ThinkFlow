import { endOfDay, startOfDay, subDays } from "date-fns";
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function toIsoDate(date) {
    return date.toISOString().split("T")[0];
}
export function rollingRange(days) {
    const now = new Date();
    const from = startOfDay(subDays(now, days - 1)).toISOString();
    const to = endOfDay(now).toISOString();
    return { from, to };
}
export function safeAvg(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}
export function pointsByBand(score, low, high) {
    if (score < low) {
        return "low";
    }
    if (score < high) {
        return "medium";
    }
    return "high";
}
