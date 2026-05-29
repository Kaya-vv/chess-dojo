import { describe, expect, it, vi } from 'vitest';
import { getCoordinateSx } from './boardThemes';
import { CoordinateSize } from './pgn/boardTools/underboard/settings/viewerSettingsConstants';

vi.mock('./pgn/boardTools/underboard/settings/ViewerSettings', () => ({
    BoardStyle: {
        Standard: 'STANDARD',
        Moon: 'MOON',
        Summer: 'SUMMER',
        Wood: 'WOOD',
        Walnut: 'WALNUT',
        CherryBlossom: 'CHERRY_BLOSSOM',
        Ocean: 'OCEAN',
    },
    PieceStyle: {
        Standard: 'STANDARD',
        Pixel: 'PIXEL',
        Spatial: 'WOOD',
        Celtic: 'CELTIC',
        Fantasy: 'FANTASY',
        Chessnut: 'CHERRY',
        Cburnett: 'WALNUT',
        ThreeD: 'THREE_D',
        ThreeDRedBlue: 'THREE_D_RED_BLUE',
        Disguised: 'DISGUISED',
        Invisible: 'INVISIBLE',
    },
}));

describe('getCoordinateSx', () => {
    it('returns the default Chessground coordinate values for standard coordinates', () => {
        expect(getCoordinateSx(CoordinateSize.Standard)).toEqual({
            '--coordinate-font-size': '9px',
            '--coordinate-font-weight': 600,
            '--coordinate-opacity': 0.8,
        });
    });

    it('returns more readable values for large coordinates', () => {
        expect(getCoordinateSx(CoordinateSize.Large)).toEqual({
            '--coordinate-font-size': '11px',
            '--coordinate-font-weight': 800,
            '--coordinate-opacity': 1,
        });
    });
});
