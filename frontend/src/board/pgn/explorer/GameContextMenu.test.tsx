import { GameContext } from '@/context/useGame';
import { Game, GameInfo } from '@/database/game';
import { useDataGridContextMenu } from '@/hooks/useDataGridContextMenu';
import { renderWithIntl } from '@/i18n/intl.test';
import { Chess } from '@jackstenglein/chess';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameContextMenu } from './GameContextMenu';

const mocks = vi.hoisted(() => ({
    getGame: vi.fn(),
    reconcile: vi.fn(),
    chess: undefined as Chess | undefined,
}));
vi.mock('@/api/Api', () => ({ useApi: () => ({ getGame: mocks.getGame }) }));
vi.mock('@/board/Board', () => ({ useReconcile: () => mocks.reconcile }));
vi.mock('@/board/pgn/PgnBoard', () => ({ useChess: () => ({ chess: mocks.chess }) }));

function Harness({
    source,
    owner = true,
    unsaved = false,
}: {
    source: GameInfo;
    owner?: boolean;
    unsaved?: boolean;
}) {
    const menu = useDataGridContextMenu();
    return (
        <GameContext.Provider
            value={{ game: { cohort: '1500-1600', id: 'target' } as Game, isOwner: owner, unsaved }}
        >
            <div data-testid='row' data-id={source.id} onContextMenu={menu.open}>
                Source game
            </div>
            <GameContextMenu
                source={menu.rowIds[0] === source.id ? source : undefined}
                menu={menu}
            />
        </GameContext.Provider>
    );
}

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('database game menu', () => {
    it.each(['masters', '1500-1600'])(
        'inserts the right source from %s and preserves navigation during the fetch',
        async (cohort) => {
            const source = {
                cohort,
                id: 'source',
                headers: { White: 'Source', Black: 'Opponent' },
                pgn: '1. e4 c5 *',
            } as Game;
            mocks.chess = new Chess({ pgn: '1. e4 e5 *' });
            mocks.chess.seek(mocks.chess.history()[0]);
            let resolve!: (value: { data: Game }) => void;
            mocks.getGame.mockReturnValue(
                new Promise((r) => {
                    resolve = r;
                }),
            );
            renderWithIntl(<Harness source={source} />);
            fireEvent.contextMenu(screen.getByTestId('row'));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Insert game with citation' }));
            const selected = mocks.chess.history()[1];
            mocks.chess.seek(selected);
            await act(async () => {
                resolve({ data: source });
                await Promise.resolve();
            });
            await screen.findByText('Game inserted.');
            expect(mocks.getGame).toHaveBeenCalledWith(cohort, 'source');
            expect(mocks.chess.currentMove()).toBe(selected);
            expect(mocks.chess.renderPgn()).toContain('Source - Opponent');
            expect(mocks.reconcile).toHaveBeenCalled();
        },
    );

    it.each([
        { owner: false, unsaved: false, editable: false },
        { owner: false, unsaved: true, editable: true },
    ])('respects editing permissions: %j', ({ owner, unsaved, editable }) => {
        mocks.chess = new Chess();
        renderWithIntl(
            <Harness source={{ id: 'source' } as GameInfo} owner={owner} unsaved={unsaved} />,
        );
        fireEvent.contextMenu(screen.getByTestId('row'));
        expect(!!screen.queryByRole('menuitem', { name: 'Cite game' })).toBe(editable);
        expect(screen.getByRole('menuitem', { name: 'Open game in new tab' })).toBeVisible();
    });

    it.each(['manual edit', 'replacement', 'permission loss'])(
        'rejects a fetched source after %s',
        async (change) => {
            const source = {
                cohort: 'masters',
                id: 'source',
                headers: {},
                pgn: '1. d4 d5 *',
            } as Game;
            mocks.chess = new Chess({ pgn: '1. e4 *' });
            let resolve!: (value: { data: Game }) => void;
            mocks.getGame.mockReturnValue(
                new Promise((r) => {
                    resolve = r;
                }),
            );
            const view = renderWithIntl(<Harness source={source} />);
            fireEvent.contextMenu(screen.getByTestId('row'));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Insert game with citation' }));
            if (change === 'manual edit') mocks.chess.setComment('new unsaved note');
            if (change === 'replacement') mocks.chess.loadPgn(mocks.chess.renderPgn());
            if (change === 'permission loss')
                view.rerender(<Harness source={source} owner={false} />);
            const edited = mocks.chess.renderPgn();
            await act(async () => {
                resolve({ data: source });
                await Promise.resolve();
            });
            await waitFor(() =>
                expect(
                    screen.getByText('Insertion cancelled because the target game changed.'),
                ).toBeVisible(),
            );
            expect(mocks.chess.renderPgn()).toBe(edited);
        },
    );
});
