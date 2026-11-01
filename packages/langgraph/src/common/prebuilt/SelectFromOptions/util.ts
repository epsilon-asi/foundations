export const formatRecord = (
    record: Record<string, string>,
    title?: string,
    delimiter?: string,
    spacing?: number): string => {
    const entries = Object.entries(record);
    const keyWidth = Math.max(0, ...entries.map(([key]) => key.length));
    const indent = " ".repeat(keyWidth + (spacing ?? 3));

    const lines = entries.map(([key, value]) =>
        `${key.padEnd(keyWidth)} ${delimiter ?? ":"} ${value.split("\n").join(`\n${indent}`)}`
    );

    if (title) {
        lines.unshift(title, "");
    }

    return lines.join("\n");
};