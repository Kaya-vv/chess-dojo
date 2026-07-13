import { EventType, trackEvent } from '@/analytics/events';
import { useApi } from '@/api/Api';
import { useAuth, useFreeTier } from '@/auth/Auth';
import { Link } from '@/components/navigation/Link';
import { MastersCohort } from '@/database/game';
import { RequirementCategory } from '@/database/requirement';
import { dojoCohorts } from '@/database/user';
import { useNextSearchParams } from '@/hooks/useNextSearchParams';
import { SearchFunc } from '@/hooks/usePagination';
import CohortIcon from '@/scoreboard/CohortIcon';
import Icon from '@/style/Icon';
import { Folder } from '@mui/icons-material';
import ArrowForwardIosSharpIcon from '@mui/icons-material/ArrowForwardIosSharp';
import {
    AccordionProps,
    AccordionSummaryProps,
    Button,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Accordion as MuiAccordion,
    AccordionDetails as MuiAccordionDetails,
    AccordionSummary as MuiAccordionSummary,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTime } from 'luxon';
import { useTranslations } from 'next-intl';
import React, { useCallback, useEffect, useState } from 'react';

const Accordion = styled((props: AccordionProps) => (
    <MuiAccordion disableGutters elevation={0} square {...props} />
))(({ theme }) => ({
    border: `1px solid ${theme.palette.divider}`,
    '&:not(:last-child)': {
        borderBottom: 0,
    },
    '&:before': {
        display: 'none',
    },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
    <MuiAccordionSummary
        expandIcon={<ArrowForwardIosSharpIcon sx={{ fontSize: '0.9rem' }} />}
        {...props}
    />
))(({ theme }) => ({
    backgroundColor:
        theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, .05)' : 'rgba(0, 0, 0, .03)',
    flexDirection: 'row-reverse',
    '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
        transform: 'rotate(90deg)',
    },
    '& .MuiAccordionSummary-content': {
        marginLeft: theme.spacing(1),
    },
}));

const AccordionDetails = styled(MuiAccordionDetails)(({ theme }) => ({
    padding: theme.spacing(2),
    borderTop: '1px solid rgba(0, 0, 0, .125)',
}));

interface BaseFilterProps {
    startDate: DateTime | null;
    endDate: DateTime | null;
    isLoading: boolean;
    setStartDate: React.Dispatch<React.SetStateAction<DateTime | null>>;
    setEndDate: React.Dispatch<React.SetStateAction<DateTime | null>>;
    onSearch: () => void;
}

type SearchByCohortProps = BaseFilterProps & {
    cohort: string;
    setCohort: (cohort: string) => void;
};

export const SearchByCohort: React.FC<SearchByCohortProps> = ({
    cohort,
    startDate,
    endDate,
    isLoading,
    setCohort,
    setStartDate,
    setEndDate,
    onSearch,
}) => {
    const t = useTranslations('games.list.searchFilters');
    return (
        <Stack data-testid='search-by-cohort' spacing={2}>
            <FormControl>
                <InputLabel>{t('cohortLabel')}</InputLabel>
                <Select
                    data-testid='cohort-select'
                    value={cohort}
                    label={t('cohortLabel')}
                    onChange={(e) => setCohort(e.target.value)}
                >
                    {dojoCohorts.concat(MastersCohort).map((c) => (
                        <MenuItem key={c} value={c}>
                            <CohortIcon
                                cohort={c}
                                size={35}
                                sx={{ marginRight: '0.6rem', verticalAlign: 'middle' }}
                                tooltip=''
                                color='primary'
                            />
                            {c === MastersCohort ? t('mastersDb') : c}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('startDate')}
                        value={startDate}
                        onChange={(newValue) => {
                            setStartDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'cohort-start-date', fullWidth: true },
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('endDate')}
                        value={endDate}
                        onChange={(newValue) => {
                            setEndDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'cohort-end-date', fullWidth: true },
                        }}
                    />
                </Grid>
            </Grid>

            <Button
                data-testid='cohort-search-button'
                variant='outlined'
                loading={isLoading}
                onClick={onSearch}
                startIcon={<Icon name='search' color='primary' />}
            >
                {t('search')}
            </Button>
        </Stack>
    );
};

const SearchByOwner: React.FC<BaseFilterProps> = ({
    startDate,
    endDate,
    isLoading,
    setStartDate,
    setEndDate,
    onSearch,
}) => {
    const t = useTranslations('games.list.searchFilters');
    return (
        <Stack data-testid='search-by-owner' spacing={2}>
            <Typography data-testid='owner-search-description' gutterBottom>
                {t('ownerDescription')}
            </Typography>
            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('startDate')}
                        value={startDate}
                        onChange={(newValue) => {
                            setStartDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'owner-start-date', fullWidth: true },
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('endDate')}
                        value={endDate}
                        onChange={(newValue) => {
                            setEndDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'owner-end-date', fullWidth: true },
                        }}
                    />
                </Grid>
            </Grid>

            <Button
                data-testid='owner-search-button'
                variant='outlined'
                loading={isLoading}
                onClick={onSearch}
                startIcon={<Icon name='search' color='primary' />}
            >
                {t('search')}
            </Button>
        </Stack>
    );
};

type SearchByPlayerProps = BaseFilterProps & {
    player: string;
    color: string;
    minElo: string;
    maxElo: string;
    result: string;
    cohort: string;
    opening: string;
    minMoves: string;
    maxMoves: string;
    timeClass: string;
    setPlayer: React.Dispatch<React.SetStateAction<string>>;
    setColor: React.Dispatch<React.SetStateAction<string>>;
    setMinElo: React.Dispatch<React.SetStateAction<string>>;
    setMaxElo: React.Dispatch<React.SetStateAction<string>>;
    setResult: React.Dispatch<React.SetStateAction<string>>;
    setCohort: React.Dispatch<React.SetStateAction<string>>;
    setOpening: React.Dispatch<React.SetStateAction<string>>;
    setMinMoves: React.Dispatch<React.SetStateAction<string>>;
    setMaxMoves: React.Dispatch<React.SetStateAction<string>>;
    setTimeClass: React.Dispatch<React.SetStateAction<string>>;
};

const SearchByPlayer: React.FC<SearchByPlayerProps> = ({
    player,
    color,
    minElo,
    maxElo,
    result,
    cohort,
    opening,
    minMoves,
    maxMoves,
    timeClass,
    startDate,
    endDate,
    isLoading,
    setPlayer,
    setColor,
    setMinElo,
    setMaxElo,
    setResult,
    setCohort,
    setOpening,
    setMinMoves,
    setMaxMoves,
    setTimeClass,
    setStartDate,
    setEndDate,
    onSearch,
}) => {
    const t = useTranslations('games.list.searchFilters');
    const isFreeTier = useFreeTier();

    return (
        <Stack data-testid='search-by-player' spacing={2}>
            <Typography gutterBottom>{t('playerDescription')}</Typography>
            <TextField
                data-testid='player-name'
                label={t('playerName')}
                value={player}
                onChange={(e) => {
                    setPlayer(e.target.value);
                    if (!e.target.value && (result === 'win' || result === 'loss')) {
                        setResult('');
                    }
                }}
            />

            <Select
                data-testid='color'
                value={color}
                label={t('color')}
                onChange={(e) => setColor(e.target.value)}
            >
                <MenuItem value='either'>{t('either')}</MenuItem>
                <MenuItem value='white'>{t('white')}</MenuItem>
                <MenuItem value='black'>{t('black')}</MenuItem>
            </Select>

            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <TextField
                        data-testid='player-min-elo'
                        label={t('minElo')}
                        type='number'
                        fullWidth
                        value={minElo}
                        onChange={(e) => setMinElo(e.target.value)}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <TextField
                        data-testid='player-max-elo'
                        label={t('maxElo')}
                        type='number'
                        fullWidth
                        value={maxElo}
                        onChange={(e) => setMaxElo(e.target.value)}
                    />
                </Grid>
            </Grid>

            <FormControl>
                <InputLabel>{t('resultLabel')}</InputLabel>
                <Select
                    data-testid='player-result'
                    value={result}
                    label={t('resultLabel')}
                    onChange={(e) => setResult(e.target.value)}
                >
                    <MenuItem value=''>{t('anyResult')}</MenuItem>
                    {player
                        ? [
                              <MenuItem key='win' value='win'>
                                  {t('win')}
                              </MenuItem>,
                              <MenuItem key='draw' value='draw'>
                                  {t('draw')}
                              </MenuItem>,
                              <MenuItem key='loss' value='loss'>
                                  {t('loss')}
                              </MenuItem>,
                          ]
                        : [
                              <MenuItem key='whiteWin' value='whiteWin'>
                                  {t('whiteWins')}
                              </MenuItem>,
                              <MenuItem key='blackWin' value='blackWin'>
                                  {t('blackWins')}
                              </MenuItem>,
                              <MenuItem key='draw' value='draw'>
                                  {t('draw')}
                              </MenuItem>,
                          ]}
                </Select>
            </FormControl>

            <FormControl>
                <InputLabel>{t('cohortLabel')}</InputLabel>
                <Select
                    data-testid='player-cohort'
                    value={cohort}
                    label={t('cohortLabel')}
                    onChange={(e) => setCohort(e.target.value)}
                >
                    <MenuItem value=''>{t('anyCohort')}</MenuItem>
                    {dojoCohorts.concat(MastersCohort).map((c) => (
                        <MenuItem key={c} value={c}>
                            {c === MastersCohort ? t('mastersDb') : c}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <TextField
                data-testid='player-opening'
                label={t('openingLabel')}
                helperText={t('openingHelp')}
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
            />

            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <TextField
                        data-testid='player-min-moves'
                        label={t('minMoves')}
                        type='number'
                        fullWidth
                        value={minMoves}
                        onChange={(e) => setMinMoves(e.target.value)}
                    />
                </Grid>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <TextField
                        data-testid='player-max-moves'
                        label={t('maxMoves')}
                        type='number'
                        fullWidth
                        value={maxMoves}
                        onChange={(e) => setMaxMoves(e.target.value)}
                    />
                </Grid>
            </Grid>

            <FormControl>
                <InputLabel>{t('timeClassLabel')}</InputLabel>
                <Select
                    data-testid='player-time-class'
                    value={timeClass}
                    label={t('timeClassLabel')}
                    onChange={(e) => setTimeClass(e.target.value)}
                >
                    <MenuItem value=''>{t('anyTimeClass')}</MenuItem>
                    <MenuItem value='bullet'>{t('bullet')}</MenuItem>
                    <MenuItem value='blitz'>{t('blitz')}</MenuItem>
                    <MenuItem value='rapid'>{t('rapid')}</MenuItem>
                    <MenuItem value='classical'>{t('classical')}</MenuItem>
                    <MenuItem value='daily'>{t('daily')}</MenuItem>
                </Select>
            </FormControl>

            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('startDate')}
                        value={startDate}
                        onChange={(newValue) => {
                            setStartDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'player-start-date', fullWidth: true },
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('endDate')}
                        value={endDate}
                        onChange={(newValue) => {
                            setEndDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'player-end-date', fullWidth: true },
                        }}
                    />
                </Grid>
            </Grid>

            <Button
                data-testid='player-search-button'
                variant='outlined'
                loading={isLoading}
                onClick={onSearch}
                disabled={isFreeTier}
                startIcon={<Icon name='search' color='primary' />}
            >
                {t('search')}
            </Button>
            {isFreeTier && (
                <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: '0 !important', alignSelf: 'center' }}
                >
                    {t('freeTierPlayer')}
                </Typography>
            )}
        </Stack>
    );
};

type SearchByOpeningProps = BaseFilterProps & {
    eco: string;
    setEco: React.Dispatch<React.SetStateAction<string>>;
};

const SearchByOpening: React.FC<SearchByOpeningProps> = ({
    eco,
    startDate,
    endDate,
    isLoading,
    setEco,
    setStartDate,
    setEndDate,
    onSearch,
}) => {
    const t = useTranslations('games.list.searchFilters');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSearch = () => {
        const errors: Record<string, string> = {};
        if (eco === '') {
            errors.eco = t('fieldRequired');
        }
        setErrors(errors);

        if (Object.entries(errors).length > 0) {
            return;
        }

        onSearch();
    };

    return (
        <Stack data-testid='search-by-opening' spacing={2}>
            <FormControl>
                <Typography gutterBottom>{t('openingDescription')}</Typography>
                <TextField
                    data-testid='opening-eco'
                    value={eco}
                    label={t('openingEco')}
                    onChange={(e) => setEco(e.target.value)}
                    error={!!errors.eco}
                    helperText={errors.eco}
                />
            </FormControl>

            <Grid container rowGap={1} columnGap={{ md: 0, lg: 1 }}>
                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('startDate')}
                        value={startDate}
                        onChange={(newValue) => {
                            setStartDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'opening-start-date', fullWidth: true },
                        }}
                    />
                </Grid>

                <Grid size={{ xs: 12, lg: 'grow' }}>
                    <DatePicker
                        label={t('endDate')}
                        value={endDate}
                        onChange={(newValue) => {
                            setEndDate(newValue);
                        }}
                        slotProps={{
                            textField: { id: 'opening-end-date', fullWidth: true },
                        }}
                    />
                </Grid>
            </Grid>

            <Button
                data-testid='opening-search-button'
                variant='outlined'
                loading={isLoading}
                onClick={handleSearch}
                startIcon={<Icon name='search' color='primary' />}
            >
                {t('search')}
            </Button>
        </Stack>
    );
};

type SearchByPositionProps = BaseFilterProps & {
    fen: string;
    setFen: React.Dispatch<React.SetStateAction<string>>;
};

const SearchByPosition: React.FC<SearchByPositionProps> = ({
    fen,
    isLoading,
    setFen,
    onSearch,
}) => {
    const t = useTranslations('games.list.searchFilters');
    const isFreeTier = useFreeTier();
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleSearch = () => {
        const errors: Record<string, string> = {};
        if (fen === '') {
            errors.fen = t('fieldRequired');
        }
        setErrors(errors);

        if (Object.entries(errors).length > 0) {
            return;
        }

        onSearch();
    };

    return (
        <Stack data-testid='search-by-position' spacing={2}>
            <FormControl>
                <TextField
                    data-testid='fen'
                    value={fen}
                    label={t('fen')}
                    onChange={(e) => setFen(e.target.value)}
                    error={!!errors.fen}
                    helperText={errors.fen}
                />
            </FormControl>

            <Button
                data-testid='fen-search-button'
                variant='outlined'
                loading={isLoading}
                onClick={handleSearch}
                disabled={isFreeTier}
                startIcon={<Icon name='search' color='primary' />}
            >
                {t('search')}
            </Button>

            {isFreeTier ? (
                <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: '0 !important', alignSelf: 'center' }}
                >
                    {t('freeTierPosition')}
                </Typography>
            ) : (
                <Button
                    href={`/games/analysis?fen=${fen}`}
                    component={Link}
                    disabled={isLoading}
                    variant='outlined'
                    startIcon={<Icon name='explore' color='primary' />}
                >
                    {t('positionExplorer')}
                </Button>
            )}
        </Stack>
    );
};

const SearchFiles = () => {
    const t = useTranslations('games.list.searchFilters');
    return (
        <Stack data-testid='search-files' spacing={2}>
            <Button href='/profile?view=games' variant='outlined'>
                {t('goToMyFiles')}
            </Button>
        </Stack>
    );
};

enum SearchType {
    Cohort = 'cohort',
    Player = 'player',
    Owner = 'owner',
    Opening = 'opening',
    Position = 'position',
    Files = 'files',
}

function isValid(d: Date | null): boolean {
    return d instanceof Date && !isNaN(d.getTime());
}

interface SearchFiltersProps {
    isLoading: boolean;
    onSearch: (searchFunc: SearchFunc) => void;
}

const SearchFilters: React.FC<SearchFiltersProps> = ({ isLoading, onSearch }) => {
    const t = useTranslations('games.list.searchFilters');
    const { user } = useAuth();
    const api = useApi();

    const { searchParams, setSearchParams } = useNextSearchParams({
        cohort: user?.dojoCohort || '',
        player: '',
        color: 'either',
        minElo: '',
        maxElo: '',
        result: '',
        playerCohort: '',
        eco: '',
        fen: '',
        type: SearchType.Cohort,
    });

    const [expanded, setExpanded] = useState<string | false>(searchParams.get('type') || '');
    const onChangePanel =
        (panel: string) => (_event: React.SyntheticEvent, newExpanded: boolean) => {
            setExpanded(newExpanded ? panel : false);
        };

    // State variables for editing the form before clicking search
    const [editCohort, setCohort] = useState(
        (searchParams.get('cohort') || '').replaceAll('%2B', '+'),
    );
    const [editPlayer, setPlayer] = useState(searchParams.get('player') || '');
    const [editColor, setColor] = useState(searchParams.get('color') || '');
    const [editMinElo, setMinElo] = useState(searchParams.get('minElo') || '');
    const [editMaxElo, setMaxElo] = useState(searchParams.get('maxElo') || '');
    const [editResult, setResult] = useState(searchParams.get('result') || '');
    const [editPlayerCohort, setPlayerCohort] = useState(searchParams.get('playerCohort') || '');
    const [editOpening, setOpening] = useState(searchParams.get('opening') || '');
    const [editMinMoves, setMinMoves] = useState(searchParams.get('minMoves') || '');
    const [editMaxMoves, setMaxMoves] = useState(searchParams.get('maxMoves') || '');
    const [editTimeClass, setTimeClass] = useState(searchParams.get('timeClass') || '');
    const [editEco, setEditEco] = useState(searchParams.get('eco') || '');
    const [editFen, setEditFen] = useState(searchParams.get('fen') || '');

    const paramsStartDate = searchParams.get('startDate');
    const paramsEndDate = searchParams.get('endDate');

    const [editStartDate, setStartDate] = useState<DateTime | null>(
        paramsStartDate ? DateTime.fromISO(paramsStartDate) : null,
    );
    const [editEndDate, setEndDate] = useState<DateTime | null>(
        paramsEndDate ? DateTime.fromISO(paramsEndDate) : null,
    );

    // Submitted variables that should be searched on
    const type = searchParams.get('type') || SearchType.Cohort;
    const cohort = searchParams.get('cohort') || user?.dojoCohort || '';
    const player = searchParams.get('player') || '';
    const color = searchParams.get('color') || 'either';
    const minElo = searchParams.get('minElo') || '';
    const maxElo = searchParams.get('maxElo') || '';
    const result = searchParams.get('result') || '';
    const playerCohort = searchParams.get('playerCohort') || '';
    const opening = searchParams.get('opening') || '';
    const minMoves = searchParams.get('minMoves') || '';
    const maxMoves = searchParams.get('maxMoves') || '';
    const timeClass = searchParams.get('timeClass') || '';
    const eco = searchParams.get('eco') || '';
    const fen = searchParams.get('fen') || '';
    const mastersOnly = searchParams.get('masters') === 'true';

    let startDateStr: string | undefined = undefined;
    let endDateStr: string | undefined = undefined;
    if (isValid(new Date(paramsStartDate || ''))) {
        startDateStr = new Date(paramsStartDate || '')
            .toISOString()
            .substring(0, 10)
            .replaceAll('-', '.');
    }
    if (isValid(new Date(paramsEndDate || ''))) {
        endDateStr = new Date(paramsEndDate || '')
            .toISOString()
            .substring(0, 10)
            .replaceAll('-', '.');
    }

    // Functions that actually perform the search
    const searchByCohort = useCallback(
        (startKey: string) => api.listGamesByCohort(cohort, startKey, startDateStr, endDateStr),
        [cohort, api, startDateStr, endDateStr],
    );

    const searchByPlayer = useCallback(
        (startKey: string) =>
            api.searchGames(
                {
                    player: player || undefined,
                    color,
                    minElo: minElo || undefined,
                    maxElo: maxElo || undefined,
                    // win/loss are relative to the player; drop them if the
                    // name was cleared after selecting one.
                    result:
                        !player && (result === 'win' || result === 'loss')
                            ? undefined
                            : result || undefined,
                    cohort: playerCohort || undefined,
                    opening: opening || undefined,
                    minMoves: minMoves || undefined,
                    maxMoves: maxMoves || undefined,
                    timeClass: timeClass || undefined,
                    startDate: startDateStr?.replaceAll('.', '-'),
                    endDate: endDateStr?.replaceAll('.', '-'),
                },
                startKey,
            ),
        [
            api,
            startDateStr,
            endDateStr,
            player,
            color,
            minElo,
            maxElo,
            result,
            playerCohort,
            opening,
            minMoves,
            maxMoves,
            timeClass,
        ],
    );

    const searchByOwner = useCallback(
        (startKey: string) =>
            api.listGamesByOwner(user?.username, startKey, startDateStr, endDateStr),
        [api, user?.username, startDateStr, endDateStr],
    );

    const searchByOpening = useCallback(
        (startKey: string) => api.listGamesByOpening(eco, startKey, startDateStr, endDateStr),
        [api, eco, startDateStr, endDateStr],
    );

    const searchByPosition = useCallback(
        (startKey: string) => api.listGamesByPosition(fen, mastersOnly, startKey),
        [api, fen, mastersOnly],
    );

    // Search is called every time the above functions change, which should
    // happen only when the searchParams change
    useEffect(() => {
        switch (type) {
            case SearchType.Owner:
                onSearch(searchByOwner);
                break;

            case SearchType.Player:
                onSearch(searchByPlayer);
                break;

            case SearchType.Cohort:
                onSearch(searchByCohort);
                break;

            case SearchType.Opening:
                onSearch(searchByOpening);
                break;

            case SearchType.Position:
                onSearch(searchByPosition);
                break;
        }
    }, [
        type,
        onSearch,
        searchByOwner,
        searchByPlayer,
        searchByCohort,
        searchByOpening,
        searchByPosition,
    ]);

    // Functions that change the search params
    const onSetSearchParams = (params: Record<string, string>) => {
        trackEvent(EventType.SearchGames, params);
        setSearchParams(params);
    };

    const onSearchByCohort = () => {
        onSetSearchParams({
            type: SearchType.Cohort,
            cohort: editCohort,
            startDate: editStartDate?.toUTC().toISO() || '',
            endDate: editEndDate?.toUTC().toISO() || '',
        });
    };

    const onSearchByPlayer = () => {
        onSetSearchParams({
            type: SearchType.Player,
            player: editPlayer,
            color: editColor,
            minElo: editMinElo,
            maxElo: editMaxElo,
            result: editResult,
            playerCohort: editPlayerCohort,
            opening: editOpening,
            minMoves: editMinMoves,
            maxMoves: editMaxMoves,
            timeClass: editTimeClass,
            startDate: editStartDate?.toUTC().toISO() || '',
            endDate: editEndDate?.toUTC().toISO() || '',
        });
    };

    const onSearchByOpening = () => {
        onSetSearchParams({
            type: SearchType.Opening,
            eco: editEco,
            startDate: editStartDate?.toUTC().toISO() || '',
            endDate: editEndDate?.toUTC().toISO() || '',
        });
    };

    const onSearchByOwner = () => {
        onSetSearchParams({
            type: SearchType.Owner,
            startDate: editStartDate?.toUTC().toISO() || '',
            endDate: editEndDate?.toUTC().toISO() || '',
        });
    };

    const onSearchByPosition = () => {
        onSetSearchParams({
            type: SearchType.Position,
            fen: editFen,
        });
    };

    return (
        <Stack spacing={0}>
            <Accordion
                id='search-by-cohort'
                expanded={expanded === SearchType.Cohort}
                onChange={onChangePanel(SearchType.Cohort)}
            >
                <AccordionSummary>
                    <Icon name='cohort' color='primary' sx={{ marginRight: '0.6rem' }} />
                    <Typography>{t('searchByCohort')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchByCohort
                        cohort={editCohort}
                        setCohort={setCohort}
                        startDate={editStartDate}
                        setStartDate={setStartDate}
                        endDate={editEndDate}
                        setEndDate={setEndDate}
                        isLoading={isLoading}
                        onSearch={onSearchByCohort}
                    />
                </AccordionDetails>
            </Accordion>
            <Accordion
                id='search-by-player'
                expanded={expanded === SearchType.Player}
                onChange={onChangePanel(SearchType.Player)}
            >
                <AccordionSummary>
                    <Icon name='player' color='primary' sx={{ marginRight: '0.6rem' }} />
                    <Typography>{t('searchByPlayer')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchByPlayer
                        player={editPlayer}
                        setPlayer={setPlayer}
                        color={editColor}
                        setColor={setColor}
                        minElo={editMinElo}
                        setMinElo={setMinElo}
                        maxElo={editMaxElo}
                        setMaxElo={setMaxElo}
                        result={editResult}
                        setResult={setResult}
                        cohort={editPlayerCohort}
                        setCohort={setPlayerCohort}
                        opening={editOpening}
                        setOpening={setOpening}
                        minMoves={editMinMoves}
                        setMinMoves={setMinMoves}
                        maxMoves={editMaxMoves}
                        setMaxMoves={setMaxMoves}
                        timeClass={editTimeClass}
                        setTimeClass={setTimeClass}
                        startDate={editStartDate}
                        setStartDate={setStartDate}
                        endDate={editEndDate}
                        setEndDate={setEndDate}
                        isLoading={isLoading}
                        onSearch={onSearchByPlayer}
                    />
                </AccordionDetails>
            </Accordion>
            <Accordion
                id='search-by-position'
                expanded={expanded === SearchType.Position}
                onChange={onChangePanel(SearchType.Position)}
            >
                <AccordionSummary>
                    <Icon
                        name={RequirementCategory.Endgame}
                        color='primary'
                        sx={{ marginRight: '0.6rem' }}
                    />
                    <Typography>{t('searchByPosition')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchByPosition
                        fen={editFen}
                        setFen={setEditFen}
                        startDate={editStartDate}
                        setStartDate={setStartDate}
                        endDate={editEndDate}
                        setEndDate={setEndDate}
                        isLoading={isLoading}
                        onSearch={onSearchByPosition}
                    />
                </AccordionDetails>
            </Accordion>
            <Accordion
                id='search-by-opening'
                expanded={expanded === SearchType.Opening}
                onChange={onChangePanel(SearchType.Opening)}
            >
                <AccordionSummary>
                    <Icon
                        name={RequirementCategory.Opening}
                        color='primary'
                        sx={{ marginRight: '0.6rem' }}
                    />
                    <Typography>{t('searchByOpening')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchByOpening
                        eco={editEco}
                        setEco={setEditEco}
                        startDate={editStartDate}
                        setStartDate={setStartDate}
                        endDate={editEndDate}
                        setEndDate={setEndDate}
                        isLoading={isLoading}
                        onSearch={onSearchByOpening}
                    />
                </AccordionDetails>
            </Accordion>
            <Accordion
                expanded={expanded === SearchType.Owner}
                onChange={onChangePanel(SearchType.Owner)}
            >
                <AccordionSummary>
                    <Icon name='upload' color='primary' sx={{ marginRight: '0.6rem' }} />
                    <Typography>{t('searchMyUploads')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchByOwner
                        startDate={editStartDate}
                        setStartDate={setStartDate}
                        endDate={editEndDate}
                        setEndDate={setEndDate}
                        isLoading={isLoading}
                        onSearch={onSearchByOwner}
                    />
                </AccordionDetails>
            </Accordion>
            <Accordion
                expanded={expanded === SearchType.Files}
                onChange={onChangePanel(SearchType.Files)}
            >
                <AccordionSummary>
                    <Folder color='primary' sx={{ mr: '0.6rem' }} />
                    <Typography>{t('myFiles')}</Typography>
                </AccordionSummary>
                <AccordionDetails>
                    <SearchFiles />
                </AccordionDetails>
            </Accordion>
        </Stack>
    );
};

export default SearchFilters;
