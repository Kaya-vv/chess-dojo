import { DefaultUnderboardTab } from '@/board/pgn/boardTools/underboard/underboardTabs';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamePage from './GamePage';

import type { ReactNode } from 'react';

const { game, pgnBoardProps } = vi.hoisted(() => ({
    game: {
        cohort: 'dojo',
        id: 'game1',
        owner: 'dojo-user',
        pgn: '1. e4 e5',
        orientation: 'white',
        headers: {
            white: 'White',
            black: 'Black',
            date: '2026.06.12',
            result: '*',
        },
    },
    pgnBoardProps: [] as Record<string, unknown>[],
}));

vi.mock('@/analytics/events', () => ({
    EventType: { UpdateGame: 'UpdateGame' },
    trackEvent: vi.fn(),
}));

vi.mock('@/api/Api', () => ({
    useApi: () => ({
        getGame: vi.fn(),
        updateGame: vi.fn(),
    }),
}));

vi.mock('@/api/gameApi', () => ({
    isMissingData: () => false,
}));

vi.mock('@/api/Request', () => ({
    RequestSnackbar: () => null,
    useRequest: () => ({
        data: game,
        reset: vi.fn(),
        isSent: () => true,
        isFailure: () => false,
        isLoading: () => false,
        onStart: vi.fn(),
        onSuccess: vi.fn(),
        onFailure: vi.fn(),
    }),
}));

vi.mock('@/auth/Auth', () => ({
    AuthStatus: {
        Authenticated: 'authenticated',
        Loading: 'loading',
    },
    useAuth: () => ({
        status: 'authenticated',
        user: {
            username: 'dojo-user',
            displayName: 'Dojo User',
        },
    }),
}));

vi.mock('@/board/pgn/PgnBoard', () => ({
    default: (props: Record<string, unknown>) => {
        pgnBoardProps.push(props);
        return <div data-testid='pgn-board' />;
    },
}));

vi.mock('@/components/games/view/GameMoveButtonExtras', () => ({
    GameMoveButtonExtras: () => <div data-testid='move-button-extras' />,
}));

vi.mock('@/games/mergeSuggestedVariations', () => ({
    mergeSuggestedVariations: vi.fn(),
}));

vi.mock('@/hooks/useNextSearchParams', () => ({
    useNextSearchParams: () => ({
        searchParams: new URLSearchParams({ firstLoad: 'false' }),
        updateSearchParams: vi.fn(),
    }),
}));

vi.mock('@/loading/LoadingPage', () => ({
    default: () => <div data-testid='loading-page' />,
}));

vi.mock('@/logging/logger', () => ({
    logger: { error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

vi.mock('../edit/MissingGameDataPreflight', () => ({
    MissingGameDataPreflight: ({ children }: { children: ReactNode }) => (
        <div data-testid='missing-game-data-preflight'>{children}</div>
    ),
}));

vi.mock('./PgnErrorBoundary', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('GamePage side tabs', () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        localStorage.clear();
        pgnBoardProps.length = 0;
    });

    it('passes default side-panel tabs to saved games', () => {
        render(<GamePage cohort='dojo' id='game1' />);

        expect(pgnBoardProps[0]).toMatchObject({
            underboardTabs: [
                DefaultUnderboardTab.Directories,
                DefaultUnderboardTab.Tags,
                DefaultUnderboardTab.Editor,
                DefaultUnderboardTab.Comments,
                DefaultUnderboardTab.Explorer,
                DefaultUnderboardTab.Clocks,
                DefaultUnderboardTab.Tools,
                DefaultUnderboardTab.Share,
                DefaultUnderboardTab.Settings,
            ],
            rightTabs: [DefaultUnderboardTab.PgnText],
            tabStorageKeyPrefix: 'game',
            sidePanelTabs: [
                DefaultUnderboardTab.Directories,
                DefaultUnderboardTab.PgnText,
                DefaultUnderboardTab.Tags,
                DefaultUnderboardTab.Editor,
                DefaultUnderboardTab.Comments,
                DefaultUnderboardTab.Explorer,
                DefaultUnderboardTab.Clocks,
                DefaultUnderboardTab.Tools,
                DefaultUnderboardTab.Share,
                DefaultUnderboardTab.Settings,
            ],
        });
    });

    it('uses stored side-panel placement on saved games', () => {
        localStorage.setItem(
            'analysisSidePanelTabs',
            JSON.stringify({
                [DefaultUnderboardTab.Explorer]: 'both',
                [DefaultUnderboardTab.Editor]: 'right',
            }),
        );

        render(<GamePage cohort='dojo' id='game1' />);

        expect(pgnBoardProps[0]).toMatchObject({
            rightTabs: [
                DefaultUnderboardTab.PgnText,
                DefaultUnderboardTab.Editor,
                DefaultUnderboardTab.Explorer,
            ],
        });
    });
});
