import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ViewerSettings, { CoordinateSize, CoordinateSizeKey, ViewerSetting } from './ViewerSettings';

vi.mock('./KeyboardShortcuts', () => ({
    default: () => null,
}));

afterEach(() => {
    cleanup();
    localStorage.clear();
});

describe('ViewerSettings coordinate size', () => {
    it('shows the coordinate size setting with the standard default', () => {
        render(<ViewerSettings />);

        expect(screen.getByRole('combobox', { name: 'Coordinate Size' })).toHaveTextContent(
            'Standard',
        );
    });

    it('persists the large coordinate size selection', async () => {
        render(<ViewerSettings />);

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Coordinate Size' }));
        const listbox = await screen.findByRole('listbox');
        fireEvent.click(within(listbox).getByRole('option', { name: 'Large' }));

        expect(localStorage.getItem(CoordinateSizeKey)).toBe(JSON.stringify(CoordinateSize.Large));
    });

    it('can be hidden by enabledSettings', () => {
        render(<ViewerSettings enabledSettings={{ [ViewerSetting.CoordinateStyle]: true }} />);

        expect(screen.queryByRole('combobox', { name: 'Coordinate Size' })).not.toBeInTheDocument();
    });

    it('can be shown by enabledSettings', () => {
        render(<ViewerSettings enabledSettings={{ [ViewerSetting.CoordinateSize]: true }} />);

        expect(screen.getByRole('combobox', { name: 'Coordinate Size' })).toBeInTheDocument();
    });
});
