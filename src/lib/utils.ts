// src/lib/utils.ts

/**
 * Converts an ISO string into a standard Philippine Time (PHT) format.
 * Expected output: "Oct 15, 2023, 4:30 PM"
 */
export const formatPHDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'Unknown Time';
    
    try {
        return new Date(isoString).toLocaleString('en-US', {
            timeZone: 'Asia/Manila',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    } catch (error) {
        console.error("Invalid date string provided to formatPHDateTime:", isoString);
        return 'Invalid Date';
    }
};