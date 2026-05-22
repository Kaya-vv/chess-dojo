import { RatingSystem } from '@/database/user';
import { describe, expect, it } from 'vitest';
import type { RatingEditor } from './RatingsEditor';
import {
    getInitialVisibleRatingSystems,
    getRatingSystemLabel,
    hasEnteredRatingSystemData,
} from './RatingsEditor';

function editor(overrides: Partial<RatingEditor> = {}): RatingEditor {
    return {
        username: '',
        hideUsername: false,
        startRating: '0',
        currentRating: '0',
        name: '',
        ...overrides,
    };
}

function editors(
    overrides: Partial<Record<RatingSystem, Partial<RatingEditor>>> = {},
): Record<RatingSystem, RatingEditor> {
    return Object.values(RatingSystem).reduce<Record<string, RatingEditor>>((result, system) => {
        result[system] = editor(overrides[system]);
        return result;
    }, {}) as Record<RatingSystem, RatingEditor>;
}

describe('RatingsEditor visibility helpers', () => {
    it('treats standard systems with usernames as configured', () => {
        expect(hasEnteredRatingSystemData(RatingSystem.Chesscom, editor({ username: 'kaya' }))).toBe(
            true,
        );
        expect(hasEnteredRatingSystemData(RatingSystem.Lichess, editor())).toBe(false);
    });

    it('treats custom systems with names or ratings as configured', () => {
        expect(hasEnteredRatingSystemData(RatingSystem.Custom, editor({ name: 'OTB' }))).toBe(true);
        expect(
            hasEnteredRatingSystemData(RatingSystem.Custom2, editor({ currentRating: '1400' })),
        ).toBe(true);
        expect(hasEnteredRatingSystemData(RatingSystem.Custom3, editor())).toBe(false);
    });

    it('always includes the preferred system first', () => {
        const result = getInitialVisibleRatingSystems(
            editors({
                [RatingSystem.Chesscom]: { username: 'kaya' },
                [RatingSystem.Uscf]: { username: '12345678' },
            }),
            RatingSystem.Uscf,
        );

        expect(result).toEqual([RatingSystem.Uscf, RatingSystem.Chesscom]);
    });

    it('disambiguates repeated custom rating labels', () => {
        expect(getRatingSystemLabel(RatingSystem.Custom)).toBe('Custom');
        expect(getRatingSystemLabel(RatingSystem.Custom2)).toBe('Custom (2)');
        expect(getRatingSystemLabel(RatingSystem.Custom3)).toBe('Custom (3)');
    });
});
