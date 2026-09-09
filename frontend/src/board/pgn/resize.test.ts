import { beforeEach, describe, expect, it } from 'vitest';
import { getNewSizes, getSizes } from './resize';

describe('collapsible panel sizing', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            writable: true,
            value: 1000,
        });
    });

    for (const width of [390, 599, 600, 899, 900, 1400]) {
        for (const left of [false, true]) {
            for (const right of [false, true]) {
                it(`fits ${width}px with left=${left}, right=${right}`, () => {
                    const options = { showPgn: right, showPanelControls: true };
                    const sizes = getSizes(width, left, false, options);
                    expect(sizes.board.width).toBe(sizes.board.height);
                    const rowWidth =
                        sizes.board.width +
                        (width >= 600 ? sizes.pgn.width : 0) +
                        (width >= 900 ? sizes.underboard.width : 0);
                    expect(rowWidth).toBeLessThanOrEqual(sizes.availableWidth + 0.001);
                    for (const data of [sizes.board, sizes.pgn, sizes.underboard]) {
                        expect(data.width).toBeGreaterThanOrEqual(data.minWidth);
                        expect(data.width).toBeLessThanOrEqual(data.maxWidth);
                        expect(data.height).toBeGreaterThanOrEqual(data.minHeight);
                        expect(data.height).toBeLessThanOrEqual(data.maxHeight);
                    }
                    if (width < 600) expect(sizes.board.width).toBe(width - sizes.padding);
                    if (left && width < 900) expect(sizes.underboard.order).toBe(1);

                    const resized = getNewSizes(
                        {
                            ...sizes,
                            board: {
                                ...sizes.board,
                                width: sizes.board.minWidth,
                                height: sizes.board.minHeight,
                            },
                        },
                        false,
                        options,
                    );
                    for (const [visible, panel] of [
                        [left, resized.underboard],
                        [right, resized.pgn],
                    ] as const) {
                        if (!visible) expect(Object.values(panel)).toEqual([0, 0, 0, 0, 0, 0]);
                    }
                    expect(resized.board.maxWidth).toBeGreaterThanOrEqual(resized.board.width);
                });
            }
        }
    }

    it('allocates initial desktop sizes based on available panels, symmetrically for either side', () => {
        window.innerHeight = 2000;
        const both = getSizes(1200, true, false, { showPanelControls: true });
        const leftOnly = getSizes(1200, true, false, { showPgn: false, showPanelControls: true });
        const rightOnly = getSizes(1200, false, false, { showPanelControls: true });
        const neither = getSizes(1200, false, false, { showPgn: false, showPanelControls: true });
        expect(leftOnly.board.width).toBeGreaterThan(both.board.width);
        expect(leftOnly.board.width).toBe(rightOnly.board.width);
        expect(neither.board.width).toBeGreaterThan(leftOnly.board.width);
        expect(neither.board.width).toBe(neither.availableWidth);
    });

    it.each([600, 900])('caps the board in a short viewport at %i px', (width) => {
        window.innerHeight = 400;
        const sizes = getSizes(width, true, false, { showPanelControls: true });
        const withoutHeaders = getSizes(width, true, true, { showPanelControls: true });
        expect(sizes.board.width).toBeCloseTo(400 - 80 - 64 - 48 - 2 * 27.9833);
        expect(sizes.board.minWidth).toBeLessThanOrEqual(sizes.board.maxWidth);
        expect(withoutHeaders.board.width - sizes.board.width).toBeCloseTo(2 * 27.9833);
    });

    it('uses the existing toolbar height without adding a row', () => {
        const legacy = getSizes(1800, true, false);
        const controls = getSizes(1800, true, false, { showPanelControls: true });
        expect(legacy.board.maxHeight - controls.board.maxHeight).toBe(0);
        expect(getSizes(800, true, false).board.width).toBe((800 - 6 - 4) * 0.66);
    });
});
