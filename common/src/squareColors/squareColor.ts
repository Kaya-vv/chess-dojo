const FILES = 'abcdefgh';

/**
 * Returns the color of a chess square.
 * A square is dark if (fileIndex + rankIndex) is even (0-indexed).
 */
export function getSquareColor(square: string): 'light' | 'dark' {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10) - 1;
    return (file + rank) % 2 === 0 ? 'dark' : 'light';
}

/**
 * Returns a random square name from a1-h8.
 */
export function getRandomSquare(): string {
    const file = FILES[Math.floor(Math.random() * 8)];
    const rank = Math.floor(Math.random() * 8) + 1;
    return `${file}${rank}`;
}

/**
 * Returns an array of `count` unique random squares with no repeats.
 */
export function getRandomSquares(count: number): string[] {
    const allSquares: string[] = [];
    for (const file of FILES) {
        for (let rank = 1; rank <= 8; rank++) {
            allSquares.push(`${file}${rank}`);
        }
    }

    // Fisher-Yates shuffle
    for (let i = allSquares.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allSquares[i], allSquares[j]] = [allSquares[j], allSquares[i]];
    }

    return allSquares.slice(0, count);
}
