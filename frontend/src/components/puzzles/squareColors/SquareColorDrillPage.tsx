'use client';

import { submitSquareColorSession } from '@/api/puzzleApi';
import { RequestSnackbar, useRequest } from '@/api/Request';
import { AuthStatus, useAuth } from '@/auth/Auth';
import LoadingPage from '@/loading/LoadingPage';
import NotFoundPage from '@/NotFoundPage';
import { SquareColorQuestion } from '@jackstenglein/chess-dojo-common/src/squareColors/api';
import {
    computeSquareColorRating,
    MIN_QUESTIONS_FOR_RATING,
} from '@jackstenglein/chess-dojo-common/src/squareColors/rating';
import {
    getRandomSquare,
    getSquareColor,
} from '@jackstenglein/chess-dojo-common/src/squareColors/squareColor';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

type DrillState = 'ready' | 'in_progress' | 'complete';

interface SessionSummary {
    totalQuestions: number;
    correctCount: number;
    avgResponseTimeMs: number;
    bestStreak: number;
    totalTimeSeconds: number;
    questions: SquareColorQuestion[];
    rating?: number;
}

/**
 * Computes aggregate stats for a square color drill session.
 * A rating is included when the user has answered at least {@link MIN_QUESTIONS_FOR_RATING} questions.
 *
 * @param allQuestions - The list of answered questions.
 * @param sessionStartTime - The epoch timestamp (ms) when the session started.
 * @returns The computed session summary, including an optional rating.
 */
export function computeSessionStats(
    allQuestions: SquareColorQuestion[],
    sessionStartTime: number,
): SessionSummary {
    const totalTimeSeconds = Math.round((Date.now() - sessionStartTime) / 1000);
    const correctCount = allQuestions.filter((q) => q.userAnswer === q.correctAnswer).length;
    const avgResponseTimeMs = Math.round(
        allQuestions.reduce((sum, q) => sum + q.responseTimeMs, 0) / allQuestions.length,
    );

    let bestStreak = 0;
    let currentStreak = 0;
    for (const q of allQuestions) {
        if (q.userAnswer === q.correctAnswer) {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    }

    let rating: number | undefined;
    if (allQuestions.length >= MIN_QUESTIONS_FOR_RATING) {
        const accuracy = (correctCount / allQuestions.length) * 100;
        rating = computeSquareColorRating(accuracy, avgResponseTimeMs);
    }

    return {
        totalQuestions: allQuestions.length,
        correctCount,
        avgResponseTimeMs,
        bestStreak,
        totalTimeSeconds,
        questions: allQuestions,
        rating,
    };
}

export function SquareColorDrillPage() {
    const { user, status } = useAuth();

    if (status === AuthStatus.Loading) {
        return <LoadingPage />;
    }
    if (!user) {
        return <NotFoundPage />;
    }

    return <SquareColorDrill />;
}

function SquareColorDrill() {
    const submitRequest = useRequest();
    const [drillState, setDrillState] = useState<DrillState>('ready');
    const [currentSquare, setCurrentSquare] = useState('');
    const [questions, setQuestions] = useState<SquareColorQuestion[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const questionStartRef = useRef<number>(0);
    const sessionStartRef = useRef<number>(0);
    const questionsRef = useRef<SquareColorQuestion[]>([]);
    const sessionCreatedAtRef = useRef<string>('');
    const [summary, setSummary] = useState<SessionSummary | null>(null);

    const nextSquare = useCallback(() => {
        setCurrentSquare((prev) => {
            const next = getRandomSquare(prev || undefined);
            return next;
        });
        questionStartRef.current = Date.now();
    }, []);

    const startDrill = useCallback(() => {
        setQuestions([]);
        questionsRef.current = [];
        setFeedback(null);
        setSummary(null);
        setDrillState('in_progress');
        sessionStartRef.current = Date.now();
        sessionCreatedAtRef.current = new Date().toISOString();
        nextSquare();
    }, [nextSquare]);

    const finishDrill = useCallback(
        (allQuestions: SquareColorQuestion[]) => {
            if (allQuestions.length === 0) {
                setDrillState('ready');
                return;
            }

            const result = computeSessionStats(allQuestions, sessionStartRef.current);

            setSummary(result);
            setDrillState('complete');

            submitRequest.onStart();
            submitSquareColorSession({
                ...result,
                createdAt: sessionCreatedAtRef.current,
            }).then(
                () => submitRequest.onSuccess(),
                (err: unknown) => submitRequest.onFailure(err),
            );
        },
        [submitRequest],
    );

    const handleAnswer = useCallback(
        (answer: 'black' | 'white') => {
            if (feedback !== null) return;

            const correctAnswer = getSquareColor(currentSquare);
            const responseTimeMs = Date.now() - questionStartRef.current;

            const question: SquareColorQuestion = {
                square: currentSquare,
                correctAnswer,
                userAnswer: answer,
                responseTimeMs,
            };

            const updatedQuestions = [...questionsRef.current, question];
            questionsRef.current = updatedQuestions;
            setQuestions(updatedQuestions);

            const stats = computeSessionStats(updatedQuestions, sessionStartRef.current);
            submitSquareColorSession({
                ...stats,
                createdAt: sessionCreatedAtRef.current,
            }).catch(() => undefined);

            setFeedback(answer === correctAnswer ? 'correct' : 'incorrect');

            setTimeout(() => {
                setFeedback(null);
                nextSquare();
            }, 400);
        },
        [feedback, currentSquare, nextSquare],
    );

    const handleStop = useCallback(() => {
        finishDrill(questionsRef.current);
    }, [finishDrill]);

    useEffect(() => {
        if (drillState === 'in_progress') {
            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'w' || e.key === 'W') {
                    handleAnswer('white');
                } else if (e.key === 'b' || e.key === 'B') {
                    handleAnswer('black');
                }
            };
            window.addEventListener('keydown', onKeyDown);
            return () => window.removeEventListener('keydown', onKeyDown);
        }
    }, [drillState, handleAnswer]);

    if (drillState === 'ready') {
        return <ReadyScreen onStart={startDrill} />;
    }

    if (drillState === 'complete' && summary) {
        return (
            <>
                <CompleteScreen summary={summary} onPlayAgain={startDrill} />
                <RequestSnackbar request={submitRequest} />
            </>
        );
    }

    const questionsRemaining = Math.max(0, MIN_QUESTIONS_FOR_RATING - questions.length);

    return (
        <Container maxWidth='sm' sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant='subtitle1' color='text.secondary' sx={{ mb: 1 }}>
                Question {questions.length + 1}
            </Typography>

            {questionsRemaining > 0 && (
                <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                    Answer {questionsRemaining} more{' '}
                    {questionsRemaining === 1 ? 'question' : 'questions'} to receive a rating
                </Typography>
            )}

            <Box
                sx={{
                    py: 6,
                    mb: 4,
                    borderRadius: 2,
                    backgroundColor:
                        feedback === 'correct'
                            ? 'success.main'
                            : feedback === 'incorrect'
                              ? 'error.main'
                              : 'transparent',
                    transition: 'background-color 0.15s',
                }}
            >
                <Typography
                    variant='h1'
                    sx={{
                        fontWeight: 'bold',
                        fontSize: { xs: '4rem', sm: '6rem' },
                        color: feedback ? 'white' : 'text.primary',
                    }}
                >
                    {currentSquare}
                </Typography>
            </Box>

            <Stack direction='row' spacing={3} justifyContent='center'>
                <Button
                    variant='contained'
                    size='large'
                    disabled={feedback !== null}
                    onClick={() => handleAnswer('white')}
                    sx={{
                        px: 5,
                        py: 2,
                        fontSize: '1.25rem',
                        backgroundColor: '#fff',
                        color: '#000',
                        border: '1px solid #ccc',
                        '&:hover': { backgroundColor: '#f0f0f0' },
                        '&.Mui-disabled': {
                            backgroundColor: '#fff',
                            color: '#000',
                            opacity: 0.6,
                        },
                    }}
                >
                    White (W)
                </Button>
                <Button
                    variant='contained'
                    size='large'
                    disabled={feedback !== null}
                    onClick={() => handleAnswer('black')}
                    sx={{
                        px: 5,
                        py: 2,
                        fontSize: '1.25rem',
                        backgroundColor: '#000',
                        color: '#fff',
                        '&:hover': { backgroundColor: '#333' },
                        '&.Mui-disabled': {
                            backgroundColor: '#000',
                            color: '#fff',
                            opacity: 0.6,
                        },
                    }}
                >
                    Black (B)
                </Button>
            </Stack>

            <Button
                variant='outlined'
                size='small'
                onClick={handleStop}
                disabled={feedback !== null}
                sx={{ mt: 4 }}
            >
                Stop
            </Button>
        </Container>
    );
}

/**
 * Landing screen shown before the drill begins. Implements a two-step "Ready / GO!"
 * flow: the first click arms the timer prompt, the second click starts the drill.
 *
 * @param onStart - Callback invoked when the user confirms they are ready to start.
 */
function ReadyScreen({ onStart }: { onStart: () => void }) {
    const [armed, setArmed] = useState(false);

    return (
        <Container maxWidth='sm' sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant='h4' sx={{ fontWeight: 'bold', mb: 2 }}>
                Square Color Drill
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ mb: 1 }}>
                You'll see a square name (like "g7") and choose whether it's a white or black
                square.
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ mb: 1 }}>
                {armed
                    ? 'Timer starts now!'
                    : "Answer as quickly and accurately as possible. Stop whenever you're ready!"}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
                {armed ? (
                    <>Press GO! to begin — your score will be timed from this moment.</>
                ) : (
                    <>
                        Keyboard shortcuts: <strong>W</strong> for White, <strong>B</strong> for
                        Black
                    </>
                )}
            </Typography>
            <Button
                variant='contained'
                size='large'
                onClick={armed ? onStart : () => setArmed(true)}
                sx={{ px: 6, py: 1.5 }}
            >
                {armed ? 'GO!' : 'Start'}
            </Button>
        </Container>
    );
}

/**
 * Summary screen shown after the drill completes.
 *
 * @param summary - The computed session statistics.
 * @param onPlayAgain - Callback invoked when the user wants to start a new session.
 */
function CompleteScreen({
    summary,
    onPlayAgain,
}: {
    summary: SessionSummary;
    onPlayAgain: () => void;
}) {
    const accuracy = Math.round((summary.correctCount / summary.totalQuestions) * 100);
    const avgTime = (summary.avgResponseTimeMs / 1000).toFixed(1);

    return (
        <Container maxWidth='sm' sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant='h4' sx={{ fontWeight: 'bold', mb: 4 }}>
                Session Complete!
            </Typography>

            <Stack spacing={2} sx={{ mb: 4 }}>
                {summary.rating !== undefined ? (
                    <Box
                        sx={{
                            py: 2,
                            mb: 1,
                            borderRadius: 2,
                            backgroundColor: 'primary.main',
                            color: 'primary.contrastText',
                        }}
                    >
                        <Typography variant='overline' sx={{ opacity: 0.85 }}>
                            Your Rating
                        </Typography>
                        <Typography variant='h3' sx={{ fontWeight: 'bold' }}>
                            {summary.rating}
                        </Typography>
                    </Box>
                ) : (
                    <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                        Answer at least {MIN_QUESTIONS_FOR_RATING} questions to receive a rating
                    </Typography>
                )}
                <StatRow
                    label='Accuracy'
                    value={`${accuracy}% (${summary.correctCount}/${summary.totalQuestions})`}
                />
                <StatRow label='Avg Response Time' value={`${avgTime}s`} />
                <StatRow label='Best Streak' value={`${summary.bestStreak}`} />
                <StatRow label='Total Time' value={`${summary.totalTimeSeconds}s`} />
            </Stack>

            <Stack spacing={1} sx={{ mb: 4, maxHeight: 300, overflow: 'auto' }}>
                {summary.questions.map((q, i) => (
                    <Stack
                        key={i}
                        direction='row'
                        justifyContent='space-between'
                        sx={{
                            px: 2,
                            py: 0.5,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography fontWeight='bold' sx={{ textAlign: 'left' }}>
                            {q.square} ({getSquareColor(q.square)})
                        </Typography>
                        <Typography
                            sx={{ flex: 1, textAlign: 'center' }}
                            color={q.userAnswer === q.correctAnswer ? 'success.main' : 'error.main'}
                        >
                            {q.userAnswer === q.correctAnswer ? 'Correct' : 'Wrong'}
                        </Typography>
                        <Typography
                            color='text.secondary'
                            sx={{ width: { sm: 76 }, textAlign: 'right' }}
                        >
                            {(q.responseTimeMs / 1000).toFixed(1)}s
                        </Typography>
                    </Stack>
                ))}
            </Stack>

            <Button variant='contained' size='large' onClick={onPlayAgain} sx={{ px: 6, py: 1.5 }}>
                Play Again
            </Button>
        </Container>
    );
}

/**
 * A single labeled stat row for the summary table.
 *
 * @param label - The human-readable label for the stat.
 * @param value - The formatted value to display.
 */
function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <Stack
            direction='row'
            justifyContent='space-between'
            sx={{
                px: 2,
                py: 1,
                borderBottom: '1px solid',
                borderColor: 'divider',
            }}
        >
            <Typography color='text.secondary'>{label}</Typography>
            <Typography fontWeight='bold'>{value}</Typography>
        </Stack>
    );
}
