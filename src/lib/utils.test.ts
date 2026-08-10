// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest'; // or 'jest' depending on your test runner
import { formatPHDateTime } from './utils';

describe('Utility Functions: formatPHDateTime', () => {
    
    it('correctly formats a UTC ISO string to Philippine Time (PHT)', () => {
        // 08:30 UTC is exactly 16:30 (4:30 PM) in Manila
        const mockUTCString = '2023-10-15T08:30:00Z'; 
        const result = formatPHDateTime(mockUTCString);
        
        expect(result).toBe('Oct 15, 2023, 4:30 PM');
    });

    it('returns "Unknown Time" when provided an empty string', () => {
        expect(formatPHDateTime('')).toBe('Unknown Time');
    });

    it('returns "Unknown Time" when provided null or undefined', () => {
        expect(formatPHDateTime(null as any)).toBe('Unknown Time');
        expect(formatPHDateTime(undefined)).toBe('Unknown Time');
    });

    it('handles garbage data gracefully without crashing', () => {
        expect(formatPHDateTime('not-a-real-date')).toBe('Invalid Date');
    });
    
});