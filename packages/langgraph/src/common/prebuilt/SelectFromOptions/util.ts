export const formatRecord = (
    record: Record<string, string>,
    title?: string,
    delimiter?: string,): string => {
    const entries = Object.entries(record);
    const keyWidth = Math.max(0, ...entries.map(([key]) => key.length));

    const lines = entries.map(([key, value]) =>
        `${key.padEnd(keyWidth)} ${delimiter ?? ":"} ${value.replace(/\s*\n\s*/g, " ")}`
    );

    if (title) {
        lines.unshift(title, "");
    }

    return lines.join("\n");
};