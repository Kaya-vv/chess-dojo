const FILES = 'abcdefgh';

/**
 * Returns the color of a chess square.
 * A square is dark if (fileIndex + rankIndex) is even (0-indexed).
 */
export function getSquareColor(square: string): 'black' | 'white' {
    const file = FILES.indexOf(square[0]);
    const rank = parseInt(square[1], 10) - 1;
    return (file + rank) % 2 === 0 ? 'black' : 'white';
}

/**
 * Returns a random square name from a1-h8.
 */
export function getRandomSquare(): string {
    const file = FILES[Math.floor(Math.random() * 8)];
    const rank = Math.floor(Math.random() * 8) + 1;
    return `${file}${rank}`;
}