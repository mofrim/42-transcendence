// -----------=[ all maybe-multi-use utility-functions go here ]=----------- //

/**
 * Convert a JS-Date-Object to a valid `YYYY-MM-DD HH:MM:SS` PostgreSQL timestamp
 *
 * @param date - the Date object
 * @returns A valid PSQL-Timestamp as string or null
 *
 * @example
 * ```
 * date2psqlstamp(new Date())
 * ```
 */
export const date2psqlstamp = (date: Date): string | null => {
    if (isNaN(date.valueOf())) return null;
    const psqlTimestamp = date.toISOString().replace('T', ' ').split('.')[0];
    if (psqlTimestamp == null) {
        console.log(`date2psqlstamp failed with date: ${date}`);
        return null;
    }
    return psqlTimestamp;
};

/**
 * Convert PSQL-timestamp back to a valid Date obj. Expects the timestamp to be
 * in UTC time.
 *
 * @param tstamp - PSQL timestamp
 * @returns Date or null
 *
 * @example
 * ```
 * psqlstamp2date('2026-12-31 23:01:54');
 * ```
 */
export const psqlstamp2date = (tstamp: string): Date | null => {
    const parts = tstamp.split(/[- :]/).map(Number);

    if (parts.includes(NaN) || parts.length != 6) return null;
    const [year, month, day, hour, minute, second] = parts;
    const date = new Date(
        Date.UTC(year!, month! - 1, day, hour, minute, second)
    );
    if (!date || isNaN(date.valueOf())) {
        console.log(`psqlstamp2date failed with tstamp: ${tstamp}`);
        return null;
    }
    return date;
};
