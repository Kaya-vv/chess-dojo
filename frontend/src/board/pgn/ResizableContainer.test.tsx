import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResizableContainer from './ResizableContainer';
import { DefaultUnderboardTab } from './boardTools/underboard/underboardTabs';

vi.mock('@/style/useWindowSizeEffect', () => ({
    useWindowSizeEffect: () => undefined,
}));

vi.mock('./KeyboardHandler', () => ({
    default: () => <div data-testid='keyboard-handler' />,
}));

vi.mock('./ResizableBoardArea', () => ({
    default: () => <div data-testid='board-area' />,
}));

vi.mock('./pgnText/PgnText', () => ({
    ResizablePgnText: () => <div data-testid='dedicated-pgn-panel' />,
}));

vi.mock('./boardTools/underboard/Underboard', () => ({
    default: ({
        tabs,
        initialTab,
        storageKey,
        explorerStorageKey,
    }: {
        tabs: unknown[];
        initialTab?: string;
        storageKey?: string;
        explorerStorageKey?: string;
    }) => (
        <div
            data-testid='underboard-panel'
            data-tabs={tabs.length}
            data-initial-tab={initialTab}
            data-storage-key={storageKey}
            data-explorer-storage-key={explorerStorageKey}
        />
    ),
}));

describe('ResizableContainer side panels', () => {
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
        expect(panels[1]).toHaveAttribute('data-initial-tab', 'pgnText');
        expect(panels[1]).toHaveAttribute('data-storage-key', 'analysis.right.tab');
        expect(panels[1]).toHaveAttribute(
            'data-explorer-storage-key',
            'analysis.right.explorerTab',
        );
        expect(screen.queryByTestId('dedicated-pgn-panel')).not.toBeInTheDocument();
    });
});
