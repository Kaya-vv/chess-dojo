import { useApi } from '@/api/Api';
import { RequestSnackbar, useRequest } from '@/api/Request';
import { useReconcile } from '@/board/Board';
import { useChess } from '@/board/pgn/PgnBoard';
import useGame from '@/context/useGame';
import { GameInfo } from '@/database/game';
import { DataGridContextMenu } from '@/hooks/useDataGridContextMenu';
import { EventType } from '@jackstenglein/chess';
import { CircularProgress, Menu, MenuItem } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { citeGame, gameUrl, insertGame } from './gameActions';

export function GameContextMenu({
    source,
    menu,
}: {
    source?: GameInfo;
    menu: DataGridContextMenu;
}) {
    const { chess } = useChess();
    const { game, isOwner, unsaved } = useGame();
    const canEdit = !!chess && !!(isOwner || unsaved);
    const api = useApi();
    const reconcile = useReconcile();
    const t = useTranslations('analysisBoard.explorer.gameActions');
    const request = useRequest<string>();
    const mounted = useRef(false);
    const busy = useRef(false);
    const generation = useRef(0);
    const current = useRef({ chess, cohort: game?.cohort, id: game?.id, canEdit });
    useLayoutEffect(() => {
        current.current = { chess, cohort: game?.cohort, id: game?.id, canEdit };
    }, [chess, game?.cohort, game?.id, canEdit]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    useEffect(() => {
        const observer = {
            types: [EventType.Initialized],
            handler: () => {
                generation.current++;
            },
        };
        chess?.addObserver(observer);
        return () => chess?.removeObserver(observer);
    }, [chess]);

    const insert = async () => {
        if (!source || !chess || !canEdit || busy.current) return;
        busy.current = true;
        const target = current.current;
        const initialGeneration = generation.current;
        const pgn = chess.renderPgn();
        request.onStart();
        try {
            const response = await api.getGame(source.cohort, source.id);
            if (!mounted.current) return;
            const latest = current.current;
            if (
                latest.chess !== chess ||
                latest.cohort !== target.cohort ||
                latest.id !== target.id ||
                initialGeneration !== generation.current ||
                !latest.canEdit ||
                chess.renderPgn() !== pgn
            ) {
                request.onFailure({ message: t('cancelled') });
                return;
            }
            try {
                insertGame(chess, response.data.pgn, response.data, window.location.origin);
            } catch {
                request.onFailure({ message: t('invalidSource') });
                return;
            }
            reconcile();
            request.onSuccess(t('inserted'));
        } catch (error) {
            if (mounted.current) request.onFailure(error);
        } finally {
            busy.current = false;
            if (mounted.current) menu.close();
        }
    };

    return (
        <>
            <Menu
                open={!!source && !!menu.position}
                onClose={menu.close}
                anchorReference='anchorPosition'
                anchorPosition={menu.position}
            >
                {canEdit && (
                    <MenuItem disabled={request.isLoading()} onClick={() => void insert()}>
                        {request.isLoading() && <CircularProgress size={16} sx={{ mr: 1 }} />}
                        {t('insert')}
                    </MenuItem>
                )}
                {canEdit && (
                    <MenuItem
                        onClick={() => {
                            if (!source || !chess) return;
                            citeGame(chess, source, window.location.origin);
                            reconcile();
                            menu.close();
                            if (!busy.current) request.onSuccess(t('cited'));
                        }}
                    >
                        {t('cite')}
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => {
                        if (source) window.open(gameUrl(source), '_blank', 'noopener');
                        menu.close();
                    }}
                >
                    {t('open')}
                </MenuItem>
            </Menu>
            <RequestSnackbar request={request} showSuccess />
        </>
    );
}
