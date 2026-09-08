import { VisibilityIcon } from '@/components/games/edit/UnpublishedGameBanner';
import { UnsavedGameIcon } from '@/components/games/edit/UnsavedGameBanner';
import useGame from '@/context/useGame';
import { useLightMode } from '@/style/useLightMode';
import ViewSidebarOutlined from '@mui/icons-material/ViewSidebarOutlined';
import { Box, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import { useTranslations } from 'next-intl';
import { useChess } from '../../PgnBoard';
import { PANEL_CONTROLS_HEIGHT } from '../../resize';
import { UnderboardApi } from '../underboard/Underboard';
import ControlButtons from './ControlButtons';
import StartButtons from './StartButtons';
import StatusIcon from './StatusIcon';

export interface PanelControls {
    left?: { visible: boolean; onToggle: () => void };
    right?: { visible: boolean; onToggle: () => void };
}

const BoardButtons = ({
    underboardRef,
    panelControls,
}: {
    underboardRef?: React.RefObject<UnderboardApi | null>;
    panelControls?: PanelControls;
}) => {
    const t = useTranslations('analysisBoard.boardButtons');
    const light = useLightMode();
    const { game, isOwner: isGameOwner, unsaved } = useGame();
    const { chess } = useChess();

    return (
        <Paper
            elevation={3}
            variant={light ? 'outlined' : 'elevation'}
            sx={{
                mt: { xs: 0.5, md: 1 },
                mb: { xs: 0.5, md: 1, xl: 0 },
                gridArea: 'boardButtons',
                boxShadow: 'none',
                visibility: chess ? undefined : 'hidden',
            }}
        >
            <Stack
                direction='row'
                sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    position: 'relative',
                }}
            >
                <StartButtons />
                <ControlButtons />
                {game && isGameOwner ? (
                    <Stack direction='row'>
                        <VisibilityIcon underboardRef={underboardRef} />
                        <StatusIcon game={game} />
                    </Stack>
                ) : unsaved ? (
                    <UnsavedGameIcon />
                ) : (
                    <Box sx={{ width: '40px' }}></Box>
                )}
            </Stack>
            {panelControls && (
                <Stack
                    direction='row'
                    sx={{
                        height: PANEL_CONTROLS_HEIGHT,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    {(['left', 'right'] as const).map((side) => {
                        const control = panelControls[side];
                        if (!control) return null;
                        const label =
                            side === 'left'
                                ? t(control.visible ? 'hideLeftPanel' : 'showLeftPanel')
                                : t(control.visible ? 'hideRightPanel' : 'showRightPanel');
                        return (
                            <Tooltip key={side} title={label}>
                                <IconButton
                                    size='small'
                                    aria-label={label}
                                    aria-expanded={control.visible}
                                    onClick={control.onToggle}
                                    sx={{ ml: side === 'right' ? 'auto' : 0 }}
                                >
                                    <ViewSidebarOutlined
                                        sx={{
                                            transform: side === 'left' ? 'scaleX(-1)' : undefined,
                                        }}
                                    />
                                </IconButton>
                            </Tooltip>
                        );
                    })}
                </Stack>
            )}
        </Paper>
    );
};

export default BoardButtons;
