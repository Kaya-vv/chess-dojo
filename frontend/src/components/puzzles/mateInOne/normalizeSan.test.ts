import { describe, expect, it } from 'vitest';
import { isCorrectAnswer, normalizeSan } from './MateInOneDrillPage';

describe('normalizeSan', () => {
    it('strips check annotation', () => {
        expect(normalizeSan('Qh7+')).toBe('qh7');
    });

    it('strips checkmate annotation', () => {
        expect(normalizeSan('Qh7#')).toBe('qh7');
    });

    it('strips promotion equals sign', () => {
        expect(normalizeSan('a8=Q')).toBe('a8q');
    });

    it('lowercases the result', () => {
        expect(normalizeSan('Nf3')).toBe('nf3');
    });

    it('handles castling', () => {
        expect(normalizeSan('O-O')).toBe('o-o');
        expect(normalizeSan('O-O-O')).toBe('o-o-o');
    });

    it('handles castling with check', () => {
        expect(normalizeSan('O-O+')).toBe('o-o');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeSan('  Qh7  ')).toBe('qh7');
    });
});

describe('isCorrectAnswer', () => {
    it('accepts exact match', () => {
        expect(isCorrectAnswer('Qh7', 'Qh7')).toBe(true);
    });

    it('accepts answer without checkmate annotation', () => {
        expect(isCorrectAnswer('Qh7', 'Qh7#')).toBe(true);
    });

    it('accepts answer without check annotation', () => {
        expect(isCorrectAnswer('Nf3', 'Nf3+')).toBe(true);
    });

    it('accepts promotion without equals sign', () => {
        expect(isCorrectAnswer('a8Q', 'a8=Q')).toBe(true);
    });

    it('rejects wrong move', () => {
        expect(isCorrectAnswer('Qh6', 'Qh7#')).toBe(false);
    });

    it('is case-insensitive', () => {
        expect(isCorrectAnswer('qh7', 'Qh7#')).toBe(true);
    });
});
