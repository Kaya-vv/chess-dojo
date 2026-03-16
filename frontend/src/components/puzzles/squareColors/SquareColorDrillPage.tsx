'use client';

import { useApi } from '@/api/Api';
import { AuthStatus, useAuth } from '@/auth/Auth';
import LoadingPage from '@/loading/LoadingPage';
import { SquareColorQuestion } from '@jackstenglein/chess-dojo-common/src/squareColors/api';
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
}

export function SquareColorDrillPage() {
    const { status } = useAuth();

    if (status === AuthStatus.Loading) {
        return <LoadingPage />;
    }

    return <SquareColorDrill />;
}

function SquareColorDrill() {
    const api = useApi();
    const [drillState, setDrillState] = useState<DrillState>('ready');
    const [currentSquare, setCurrentSquare] = useState('');
    const [questions, setQuestions] = useState<SquareColorQuestion[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const questionStartRef = useRef<number>(0);
    const sessionStartRef = useRef<number>(0);
    const [summary, setSummary] = useState<SessionSummary | null>(null);

    const nextSquare = useCallback(() => {
        setCurrentSquare(getRandomSquare());
        questionStartRef.current = Date.now();
    }, []);

    const startDrill = useCallback(() => {
        setQuestions([]);
        setFeedback(null);
        setSummary(null);
        setDrillState('in_progress');
        sessionStartRef.current = Date.now();
        nextSquare();
    }, [nextSquare]);

    const finishDrill = useCallback(
        (allQuestions: SquareColorQuestion[]) => {
            if (allQuestions.length === 0) {
                setDrillState('ready');
                return;
            }

            const totalTimeSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);
            const correctCount = allQuestions.filter(
                (q) => q.userAnswer === q.correctAnswer,
            ).length;
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

            const result: SessionSummary = {
                totalQuestions: allQuestions.length,
                correctCount,
                avgResponseTimeMs,
                bestStreak,
                totalTimeSeconds,
                questions: allQuestions,
            };

            setSummary(result);
            setDrillState('complete');

            api.submitSquareColorSession(result).catch((err: unknown) => {
                console.error('Failed to submit square color session:', err);
            });
        },
        [api],
    );

    const handleAnswer = useCallback(
        (answer: 'light' | 'dark') => {
            if (feedback !== null) return;

            const correctAnswer = getSquareColor(currentSquare);
            const responseTimeMs = Date.now() - questionStartRef.current;

            const question: SquareColorQuestion = {
                square: currentSquare,
                correctAnswer,
                userAnswer: answer,
                responseTimeMs,
            };

            const updatedQuestions = [...questions, question];
            setQuestions(updatedQuestions);
            setFeedback(answer === correctAnswer ? 'correct' : 'incorrect');

            setTimeout(() => {
                setFeedback(null);
                nextSquare();
            }, 400);
        },
        [feedback, currentSquare, questions, nextSquare],
    );

    const handleStop = useCallback(() => {
        finishDrill(questions);
    }, [finishDrill, questions]);

    useEffect(() => {
        if (drillState === 'in_progress') {
            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'l' || e.key === 'L') {
                    handleAnswer('light');
                } else if (e.key === 'd' || e.key === 'D') {
                    handleAnswer('dark');
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
        return <CompleteScreen summary={summary} onPlayAgain={startDrill} />;
    }

    return (
        <Container maxWidth='sm' sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant='subtitle1' color='text.secondary' sx={{ mb: 1 }}>
                Question {questions.length + 1}
            </Typography>

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
                    onClick={() => handleAnswer('light')}
                    sx={{
                        px: 5,
                        py: 2,
                        fontSize: '1.25rem',
                        backgroundColor: '#f0d9b5',
                        color: '#000',
                        '&:hover': { backgroundColor: '#e6c99e' },
                        '&.Mui-disabled': {
                            backgroundColor: '#f0d9b5',
                            color: '#000',
                            opacity: 0.6,
                        },
                    }}
                >
                    Light (L)
                </Button>
                <Button
                    variant='contained'
                    size='large'
                    disabled={feedback !== null}
                    onClick={() => handleAnswer('dark')}
                    sx={{
                        px: 5,
                        py: 2,
                        fontSize: '1.25rem',
                        backgroundColor: '#b58863',
                        color: '#fff',
                        '&:hover': { backgroundColor: '#a07652' },
                        '&.Mui-disabled': {
                            backgroundColor: '#b58863',
                            color: '#fff',
                            opacity: 0.6,
                        },
                    }}
                >
                    Dark (D)
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

function ReadyScreen({ onStart }: { onStart: () => void }) {
    return (
        <Container maxWidth='sm' sx={{ py: 8, textAlign: 'center' }}>
            <Typography variant='h4' sx={{ fontWeight: 'bold', mb: 2 }}>
                Square Color Drill
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ mb: 1 }}>
                You&apos;ll see a square name (like &quot;g7&quot;) and choose whether it&apos;s a
                light or dark square.
            </Typography>
            <Typography variant='body1' color='text.secondary' sx={{ mb: 1 }}>
                Answer as quickly and accurately as possible. Stop whenever you&apos;re ready!
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
                Keyboard shortcuts: <strong>L</strong> for Light, <strong>D</strong> for Dark
            </Typography>
            <Button variant='contained' size='large' onClick={onStart} sx={{ px: 6, py: 1.5 }}>
                Start
            </Button>
        </Container>
    );
}

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
                        <Typography fontWeight='bold'>{q.square}</Typography>
                        <Typography
                            color={q.userAnswer === q.correctAnswer ? 'success.main' : 'error.main'}
                        >
                            {q.userAnswer === q.correctAnswer
                                ? 'Correct'
                                : `Wrong (was ${q.correctAnswer})`}
                        </Typography>
                        <Typography color='text.secondary'>
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
