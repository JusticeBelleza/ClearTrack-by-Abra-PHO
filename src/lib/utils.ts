// src/lib/utils.ts

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
    } catch { // <-- Removed (_error) completely
        console.error("Invalid date string provided to formatPHDateTime:", isoString);
        return 'Invalid Date';
    }
};