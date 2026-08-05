import { renderWithIntl } from '@/i18n/intl.test';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MainClubChip } from './MainClubChip';

vi.mock('@mui/icons-material', () => ({
    Star: () => <span data-testid='main-club-icon' />,
}));

describe('MainClubChip', () => {
    it('shows the main club label', () => {
        renderWithIntl(<MainClubChip />);

        expect(screen.getByText('Main Club')).toBeVisible();
    });
});
