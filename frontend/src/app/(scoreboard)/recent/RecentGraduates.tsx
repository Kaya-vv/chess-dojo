'use client';

import { useApi } from '@/api/Api';
import { GameApiContextType } from '@/api/gameApi';
import { RequestSnackbar, useRequest } from '@/api/Request';
import { Link } from '@/components/navigation/Link';
import { Graduation } from '@/database/graduation';
import { compareCohorts } from '@/database/user';
import LoadingPage from '@/loading/LoadingPage';
import Avatar from '@/profile/Avatar';
import CohortIcon from '@/scoreboard/CohortIcon';
import {
    CircularProgress,
    Divider,
    FormControl,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridRenderCellParams, GridRowParams } from '@mui/x-data-grid-pro';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function getUniqueGraduations(graduations: Graduation[]): Graduation[] {
    return [...new Map(graduations.map((g) => [g.username, g])).values()];
}

const graduationDayOfWeek = 3; // Wednesday
const numberOfOptions = 4;
const lastWeek = new Date();
lastWeek.setDate(lastWeek.getDate() - 7);

interface Timeframe {
    minDate: string;
    maxDate: string;
}

interface TimeframeOption {
    label: string;
    value: Timeframe;
}

function getTimeframeOptions() {
    let currGraduation = new Date();
    currGraduation.setUTCHours(17, 30, 0, 0);
    currGraduation.setUTCDate(
        currGraduation.getUTCDate() + ((graduationDayOfWeek + 7 - currGraduation.getUTCDay()) % 7),
    );

    const options: TimeframeOption[] = [];

    for (let i = 0; i < numberOfOptions; i++) {
        const prevGraduation = new Date(currGraduation);
        prevGraduation.setUTCDate(prevGraduation.getUTCDate() - 7);

        options.push({
            label: `Graduation of ${currGraduation.toLocaleDateString()}`,
            value: {
                minDate: prevGraduation.toISOString(),
                maxDate: currGraduation.toISOString(),
            },
        });

        currGraduation = prevGraduation;
    }

    return options;
}

const timeframeOptions = getTimeframeOptions();

/**
 * Formats a date as YYYY.MM.DD (the period-separated format used by the games API).
 * @param date The date to format.
 * @returns The date formatted as YYYY.MM.DD.
 */
function formatGameDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

/**
 * Fetches the total game count for a user by paginating through listGamesByOwner.
 * @param api The game API context to use for requests.
 * @param owner The username of the game owner.
 * @param startDate The start date filter in YYYY.MM.DD format.
 * @param endDate The end date filter in YYYY.MM.DD format.
 * @returns The total number of games owned by the user in the date range.
 */
async function fetchGameCount(
    api: GameApiContextType,
    owner: string,
    startDate: string,
    endDate: string,
): Promise<number> {
    let count = 0;
    let startKey: string | undefined;
    do {
        const resp = await api.listGamesByOwner(owner, startKey, startDate, endDate);
        count += resp.data.games.length;
        startKey = resp.data.lastEvaluatedKey;
    } while (startKey);
    return count;
}

/**
 * Cell component that shows the stored gamesAnnotated count, or fetches it live
 * for old graduation records that don't have it stored.
 */
function GamesAnnotatedCell({
    graduation,
    api,
}: {
    graduation: Graduation;
    api: GameApiContextType;
}) {
    const [count, setCount] = useState<number | null>(
        graduation.gamesAnnotated !== undefined ? graduation.gamesAnnotated : null,
    );
    const fetchedRef = useRef(false);

    const fetchCount = useCallback(async () => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;
        try {
            const gradDate = new Date(graduation.createdAt);
            const twoMonthsBefore = new Date(gradDate);
            twoMonthsBefore.setMonth(twoMonthsBefore.getMonth() - 2);
            const result = await fetchGameCount(
                api,
                graduation.username,
                formatGameDate(twoMonthsBefore),
                formatGameDate(gradDate),
            );
            setCount(result);
        } catch {
            setCount(0);
        }
    }, [api, graduation.createdAt, graduation.username]);

    useEffect(() => {
        if (count === null) {
            fetchCount();
        }
    }, [count, fetchCount]);

    if (count === null) {
        return <CircularProgress size={16} />;
    }
    return <>{count}</>;
}

function getGraduateTableColumns(api: GameApiContextType): GridColDef<Graduation>[] {
    return [
        {
            field: 'displayName',
            headerName: 'Name',
            minWidth: 200,
            flex: 1,
            renderCell: (params: GridRenderCellParams<Graduation, string>) => {
                return (
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <Avatar
                            username={params.row.username}
                            displayName={params.value}
                            size={32}
                        />
                        <Link href={`/profile/${params.row.username}`}>{params.value}</Link>
                    </Stack>
                );
            },
        },
        {
            field: 'graduations',
            headerName: 'Graduated',
            align: 'center',
            headerAlign: 'center',
            minWidth: 150,
            flex: 1,
            valueGetter: (_value, row) => {
                if (row.graduationCohorts && row.graduationCohorts.length > 0) {
                    return row.graduationCohorts;
                }
                return row.previousCohort;
            },
            renderCell: (params: GridRenderCellParams<Graduation>) => {
                const graduationCohorts = [...params.row.graduationCohorts]
                    .sort(compareCohorts)
                    .filter((cohort, i, array) => i === array.indexOf(cohort))
                    .slice(-3);
                return (
                    <Stack direction='row' justifyContent='center'>
                        {graduationCohorts.map((c) => (
                            <CohortIcon key={c} cohort={c} size={32} />
                        ))}
                    </Stack>
                );
            },
        },
        {
            field: 'previousCohort',
            headerName: 'Old Cohort',
            minWidth: 150,
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            valueGetter: (_value, row) => {
                return parseInt(row.previousCohort.split('-')[0]);
            },
            renderCell: (params: GridRenderCellParams<Graduation>) => {
                return (
                    <Stack height='30px' justifyContent='center'>
                        {params.row.previousCohort}
                    </Stack>
                );
            },
        },
        {
            field: 'newCohort',
            headerName: 'New Cohort',
            minWidth: 150,
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            valueGetter: (_value, row) => {
                return parseInt(row.newCohort.replaceAll('+', '').split('-')[0]);
            },
            renderCell: (params: GridRenderCellParams<Graduation>) => {
                return (
                    <Stack height='30px' justifyContent='center'>
                        {params.row.newCohort}
                    </Stack>
                );
            },
        },
        {
            field: 'score',
            headerName: 'Dojo Score',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            valueFormatter: (value) => Math.round(value * 100) / 100,
            renderCell: (params) => (
                <Stack height='30px' justifyContent='center'>
                    {params.formattedValue}
                </Stack>
            ),
        },
        {
            field: 'gamesAnnotated',
            headerName: 'Games Annotated',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            renderCell: (params: GridRenderCellParams<Graduation>) => (
                <Stack height='30px' justifyContent='center'>
                    <GamesAnnotatedCell graduation={params.row} api={api} />
                </Stack>
            ),
        },
        {
            field: 'createdAt',
            headerName: 'Date',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            valueFormatter: (value) => new Date(value).toLocaleDateString(),
            renderCell: (params) => (
                <Stack height='30px' justifyContent='center'>
                    {params.formattedValue}
                </Stack>
            ),
        },
    ];
}

function DetailPanelContent(params: GridRowParams<Graduation>) {
    if (!params.row.comments) {
        return '';
    }
    return (
        <Typography mx={2} my={1}>
            {params.row.comments}
        </Typography>
    );
}

function getDetailPanelHeight(): 'auto' {
    return 'auto';
}

const RecentGraduates = () => {
    const api = useApi();
    const request = useRequest<Graduation[]>();
    const [timeframe, setTimeframe] = useState<Timeframe>(timeframeOptions[0]?.value);
    const columns = useMemo(() => getGraduateTableColumns(api), [api]);

    useEffect(() => {
        if (!request.isSent()) {
            request.onStart();
            api.listGraduationsByDate()
                .then((graduations) => request.onSuccess(graduations))
                .catch((err) => {
                    request.onFailure(err);
                });
        }
    }, [request, api]);

    const graduations = useMemo(() => {
        const gs = request.data ?? [];
        return getUniqueGraduations(
            gs.filter((g) => g.createdAt >= timeframe.minDate && g.createdAt < timeframe.maxDate),
        );
    }, [request.data, timeframe]);

    return (
        <Stack spacing={3}>
            <RequestSnackbar request={request} />
            <Stack>
                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                    <Typography variant='h6'>Recent Graduates</Typography>
                    <FormControl
                        data-testid='graduates-timeframe-select'
                        size='small'
                        variant='standard'
                    >
                        <Select
                            value={timeframe}
                            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                            sx={{
                                '::before': {
                                    border: 'none !important',
                                },
                                '& div': {
                                    paddingBottom: 0,
                                },
                            }}
                        >
                            {timeframeOptions.map((option) => (
                                <MenuItem
                                    data-testid={option.label}
                                    key={option.label}
                                    value={option.value as unknown as string}
                                >
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
                <Divider />
            </Stack>

            {graduations.length === 0 ? (
                request.isLoading() ? (
                    <LoadingPage />
                ) : (
                    <Typography>No graduations in the selected timeframe</Typography>
                )
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <DataGridPro
                        columns={columns}
                        rows={graduations}
                        getRowId={(row: Graduation) => row.username}
                        getRowHeight={() => 'auto'}
                        sx={{
                            width: 1,
                            '&.MuiDataGrid-root--densityCompact .MuiDataGrid-cell': {
                                py: '8px',
                            },
                            '&.MuiDataGrid-root--densityStandard .MuiDataGrid-cell': {
                                py: '15px',
                            },
                            '&.MuiDataGrid-root--densityComfortable .MuiDataGrid-cell': {
                                py: '22px',
                            },
                        }}
                        pageSizeOptions={[10, 25, 100]}
                        initialState={{
                            pagination: {
                                paginationModel: {
                                    page: 0,
                                    pageSize: 100,
                                },
                            },
                            sorting: {
                                sortModel: [{ field: 'newCohort', sort: 'asc' }],
                            },
                            detailPanel: {
                                expandedRowIds: new Set(graduations.map((g) => g.username)),
                            },
                        }}
                        getDetailPanelContent={DetailPanelContent}
                        getDetailPanelHeight={getDetailPanelHeight}
                        pagination
                        slotProps={{
                            root: { 'data-testid': 'recent-graduates-table' },
                        }}
                    />
                </div>
            )}
        </Stack>
    );
};

export default RecentGraduates;
