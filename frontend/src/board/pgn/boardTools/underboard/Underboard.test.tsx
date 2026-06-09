import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Underboard from './Underboard';
import { DefaultUnderboardTab } from './underboardTabs';

import type { ReactNode } from 'react';

const { explorerProps } = vi.hoisted(() => ({
    explorerProps: [] as Array<{ storageKey?: string }>,
}));

vi.mock('@mui/icons-material', () => ({
    AccessAlarm: () => <span data-testid='icon-clock' />,
    Article: () => <span data-testid='icon-pgn-text' />,
    Chat: () => <span data-testid='icon-chat' />,
    Construction: () => <span data-testid='icon-tools' />,
    Edit: () => <span data-testid='icon-edit' />,
    Folder: () => <span data-testid='icon-folder' />,
    MoreHoriz: () => <span data-testid='icon-more' />,
    Sell: () => <span data-testid='icon-tags' />,
    Settings: () => <span data-testid='icon-settings' />,
    Share: () => <span data-testid='icon-share' />,
    Storage: () => <span data-testid='icon-storage' />,
}));

vi.mock('@/auth/Auth', () => ({
    AuthStatus: { Authenticated: 'authenticated' },
    useAuth: () => ({ status: 'authenticated' }),
}));

vi.mock('@/context/useGame', () => ({
    default: () => ({ game: undefined, isOwner: true }),
}));

vi.mock('@/style/useLightMode', () => ({
    useLightMode: () => true,
}));

vi.mock('react-resizable', () => ({
    Resizable: ({ children }: { children: ReactNode }) => (
        <div data-testid='resizable'>{children}</div>
    ),
}));

vi.mock('../../PgnBoard', () => ({
    useChess: () => ({ chess: {} }),
}));

vi.mock('../../ResizeHandle', () => ({
    default: () => <div data-testid='resize-handle' />,
}));

vi.mock('../../pgnText/PgnText', () => ({
    UnderboardPgnText: () => <div data-testid='underboard-pgn-text'>PGN text tab</div>,
}));

vi.mock('../../explorer/Explorer', () => ({
    default: (props: { storageKey?: string }) => {
        explorerProps.push(props);
        return <div data-testid='explorer-tab'>Explorer tab</div>;
    },
}));

vi.mock('../../explorer/player/PlayerOpeningTree', () => ({
    PlayerOpeningTreeProvider: ({ children }: { children: ReactNode }) => (
        <div data-testid='player-opening-tree-provider'>{children}</div>
    ),
}));

vi.mock('./Editor', () => ({
    default: () => <div data-testid='editor-tab' />,
}));

vi.mock('./clock/ClockUsage', () => ({
    default: () => <div data-testid='clock-tab' />,
}));

vi.mock('./comments/Comments', () => ({
    default: () => <div data-testid='comments-tab' />,
}));

vi.mock('./directories/Directories', () => ({
    Directories: () => <div data-testid='directories-tab' />,
}));

vi.mock('./settings/Settings', () => ({
    default: () => <div data-testid='settings-tab' />,
}));

vi.mock('./share/ShareTab', () => ({
    ShareTab: () => <div data-testid='share-tab' />,
}));

vi.mock('./tags/Tags', () => ({
    default: () => <div data-testid='tags-tab' />,
}));

vi.mock('./tools/Tools', () => ({
    Tools: () => <div data-testid='tools-tab' />,
}));

const resizeData = {
    width: 480,
    minWidth: 100,
    maxWidth: 800,
    height: 500,
    minHeight: 200,
    maxHeight: 800,
};

describe('Underboard side-panel tabs', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        explorerProps.length = 0;
    });

    it('renders PGN Text as a selectable tab', () => {
        render(
            <Underboard
                tabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                initialTab={DefaultUnderboardTab.Explorer}
                resizeData={resizeData}
                onResize={vi.fn()}
            />,
        );

        expect(screen.getByTestId('explorer-tab')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('underboard-button-pgnText'));

        expect(screen.getByTestId('underboard-pgn-text')).toBeInTheDocument();
    });

    it('uses the provided tab storage key when no forced initial tab is set', () => {
        render(
            <Underboard
                tabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                storageKey='analysis.left.tab'
                resizeData={resizeData}
                onResize={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByTestId('underboard-button-pgnText'));

        expect(localStorage.getItem('analysis.left.tab')).toBe(JSON.stringify('pgnText'));
        expect(localStorage.getItem('underboardTab')).toBeNull();
    });

    it('passes the panel-scoped Explorer storage key', () => {
        render(
            <Underboard
                tabs={[DefaultUnderboardTab.Explorer, DefaultUnderboardTab.PgnText]}
                initialTab={DefaultUnderboardTab.Explorer}
                explorerStorageKey='analysis.left.explorerTab'
                resizeData={resizeData}
                onResize={vi.fn()}
            />,
        );

        expect(screen.getByTestId('player-opening-tree-provider')).toBeInTheDocument();
        expect(explorerProps[0]).toEqual({ storageKey: 'analysis.left.explorerTab' });
    });
});
