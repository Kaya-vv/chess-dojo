import { renderWithIntl as render } from '@/i18n/intl.test';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResizableContainer from './ResizableContainer';
import type { PanelControls } from './boardTools/boardButtons/BoardButtons';
import { DefaultUnderboardTab } from './boardTools/underboard/underboardTabs';

import type { ReactNode } from 'react';

vi.mock('@/style/useLightMode', () => ({ useLightMode: () => true }));
vi.mock('@/context/useGame', () => ({ default: () => ({}) }));
vi.mock('./PgnBoard', () => ({ useChess: () => ({ chess: {} }) }));
vi.mock('./boardTools/boardButtons/StartButtons', () => ({ default: () => null }));
vi.mock('./boardTools/boardButtons/ControlButtons', () => ({ default: () => null }));
vi.mock('./boardTools/boardButtons/StatusIcon', () => ({ default: () => null }));
vi.mock('@/components/games/edit/UnpublishedGameBanner', () => ({ VisibilityIcon: () => null }));
vi.mock('@/components/games/edit/UnsavedGameBanner', () => ({ UnsavedGameIcon: () => null }));

vi.mock('./KeyboardHandler', () => ({
    default: () => <div data-testid='keyboard-handler' />,
}));

vi.mock('./ResizableBoardArea', async () => {
    const { default: BoardButtons } = await import('./boardTools/boardButtons/BoardButtons');
    return {
        default: ({
            panelControls,
            resizeData,
        }: {
            panelControls?: PanelControls;
            resizeData: { width: number };
        }) => (
            <div data-testid='board-area' data-width={resizeData.width}>
                <input aria-label='board state' />
                <BoardButtons panelControls={panelControls} />
            </div>
        ),
    };
});

vi.mock('./pgnText/PgnText', () => ({
    PgnTextBanners: () => <div data-testid='pgn-text-banners' />,
    ResizablePgnText: ({ hidden }: { hidden?: boolean }) => (
        <div data-testid='dedicated-pgn-panel' style={{ display: hidden ? 'none' : undefined }} />
    ),
}));

vi.mock('./boardTools/underboard/Underboard', () => ({
    default: ({
        tabs,
        initialTab,
        storageKey,
        explorerStorageKey,
        buttonTestIdPrefix,
        header,
        sidePanelTabs,
        hidden,
    }: {
        tabs: unknown[];
        initialTab?: string;
        storageKey?: string;
        explorerStorageKey?: string;
        buttonTestIdPrefix?: string;
        header?: ReactNode;
        sidePanelTabs?: unknown[];
        hidden?: boolean;
    }) => (
        <div
            data-testid='underboard-panel'
            data-tabs={tabs.length}
            data-initial-tab={initialTab}
            data-storage-key={storageKey}
            data-explorer-storage-key={explorerStorageKey}
            data-button-test-id-prefix={buttonTestIdPrefix}
            data-has-header={header ? 'true' : 'false'}
            data-side-panel-tabs={sidePanelTabs?.length ?? 0}
            style={{ display: hidden ? 'none' : undefined }}
        >
            <input aria-label={`${buttonTestIdPrefix || 'left-'}draft`} />
        </div>
    ),
}));

describe('ResizableContainer side panels', () => {
    const board = (allowPanelHiding = true, left = true, right = true) => (
        <div id='resize-container'>
            <ResizableContainer
                allowPanelHiding={allowPanelHiding}
                underboardTabs={left ? [DefaultUnderboardTab.Explorer] : []}
                rightTabs={right ? [DefaultUnderboardTab.PgnText] : []}
                onInitialize={vi.fn()}
            />
        </div>
    );

    it('toggles panels independently, retains mounted state, and resets on a fresh mount', () => {
        const { unmount } = render(board());
        const initialWidth = Number(screen.getByTestId('board-area').dataset.width);
        const draft = screen.getByRole('textbox', { name: 'left-draft' });
        fireEvent.change(draft, { target: { value: 'Unfinished comment' } });
        const position = screen.getByRole('textbox', { name: 'board state' });
        fireEvent.change(position, { target: { value: 'e4 e5 Nf3' } });
        fireEvent.click(screen.getByRole('button', { name: 'Hide left panel' }));
        expect(draft).not.toBeVisible();
        expect(screen.getAllByTestId('underboard-panel')[1]).toBeVisible();
        expect(Number(screen.getByTestId('board-area').dataset.width)).toBeGreaterThan(
            initialWidth,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Hide right panel' }));
        expect(screen.getByRole('button', { name: 'Show right panel' })).toHaveAttribute(
            'aria-expanded',
            'false',
        );
        fireEvent.click(screen.getByRole('button', { name: 'Show left panel' }));
        expect(draft).toBeVisible();
        expect(draft).toHaveValue('Unfinished comment');
        expect(position).toHaveValue('e4 e5 Nf3');
        fireEvent.click(screen.getByRole('button', { name: 'Show right panel' }));
        expect(Number(screen.getByTestId('board-area').dataset.width)).toBe(initialWidth);
        fireEvent.click(screen.getByRole('button', { name: 'Hide left panel' }));
        unmount();
        render(board());
        expect(screen.getByRole('button', { name: 'Hide left panel' })).toHaveAttribute(
            'aria-expanded',
            'true',
        );
    });

    it('keeps restore controls available across window resizing', () => {
        render(board());
        fireEvent.click(screen.getByRole('button', { name: 'Hide right panel' }));
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            width: 390,
        } as DOMRect);
        fireEvent(window, new Event('resize'));
        expect(Number(screen.getByTestId('board-area').dataset.width)).toBe(384);
        expect(screen.getByRole('button', { name: 'Show right panel' })).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Show right panel' }));
        expect(screen.getAllByTestId('underboard-panel')[1]).toBeVisible();
    });

    it('does not offer hiding unless enabled', () => {
        render(board(false));
        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it.each([
        [false, true],
        [true, false],
        [false, false],
    ])('omits toggles for missing panels (%s, %s)', (left, right) => {
        render(board(true, left, right));
        expect(Boolean(screen.queryByRole('button', { name: 'Hide left panel' }))).toBe(left);
        expect(Boolean(screen.queryByRole('button', { name: 'Hide right panel' }))).toBe(right);
    });
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
            configurable: true,
            value: () => ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800 }),
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 900,
        });
    });

    it('keeps the dedicated PGN panel when rightTabs is omitted', () => {
        render(
            <div id='resize-container'>
                <ResizableContainer
                    underboardTabs={[DefaultUnderboardTab.Explorer]}
                    initialUnderboardTab={DefaultUnderboardTab.Explorer}
                    pgn='1. e4'
                    onInitialize={vi.fn()}
                />
            </div>,
        );

        expect(screen.getAllByTestId('underboard-panel')).toHaveLength(1);
        expect(screen.getByTestId('dedicated-pgn-panel')).toBeInTheDocument();
    });

    it('renders a right tab host when rightTabs is provided', () => {
        render(
            <div id='resize-container'>
                <ResizableContainer
                    underboardTabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                    initialUnderboardTab={DefaultUnderboardTab.Explorer}
                    rightTabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                    initialRightTab={DefaultUnderboardTab.PgnText}
                    sidePanelTabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                    tabStorageKeyPrefix='analysis'
                    pgn='1. e4'
                    onInitialize={vi.fn()}
                />
            </div>,
        );

        const panels = screen.getAllByTestId('underboard-panel');
        expect(panels).toHaveLength(2);
        expect(panels[0]).toHaveAttribute('data-initial-tab', 'explorer');
        expect(panels[0]).toHaveAttribute('data-storage-key', 'analysis.left.tab');
        expect(panels[0]).toHaveAttribute('data-explorer-storage-key', 'analysis.left.explorerTab');
        expect(panels[0]).toHaveAttribute('data-has-header', 'false');
        expect(panels[0]).toHaveAttribute('data-side-panel-tabs', '2');
        expect(panels[1]).toHaveAttribute('data-initial-tab', 'pgnText');
        expect(panels[1]).toHaveAttribute('data-storage-key', 'analysis.right.tab');
        expect(panels[1]).toHaveAttribute(
            'data-explorer-storage-key',
            'analysis.right.explorerTab',
        );
        expect(panels[1]).toHaveAttribute('data-button-test-id-prefix', 'right-');
        expect(panels[1]).toHaveAttribute('data-has-header', 'true');
        expect(panels[1]).toHaveAttribute('data-side-panel-tabs', '2');
        expect(screen.queryByTestId('dedicated-pgn-panel')).not.toBeInTheDocument();
    });
});
