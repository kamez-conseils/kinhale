import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import CaregiversIndexScreen from '../index';
import { renderWithProviders } from '../../../src/test-utils/render';
import { listInvitations, revokeInvitation } from '../../../src/lib/invitations/client';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@kinhale/sync', () => ({
  projectCaregivers: () => [],
}));

jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: null }) => unknown) => selector({ doc: null })),
}));

jest.mock('../../../src/lib/invitations/client', () => ({
  listInvitations: jest.fn().mockResolvedValue([]),
  revokeInvitation: jest.fn().mockResolvedValue(undefined),
}));

const mockListInvitations = listInvitations as jest.MockedFunction<typeof listInvitations>;
const mockRevokeInvitation = revokeInvitation as jest.MockedFunction<typeof revokeInvitation>;

describe('CaregiversIndexScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListInvitations.mockResolvedValue([]);
    mockRevokeInvitation.mockResolvedValue(undefined);
  });

  it("affiche l'état vide quand il n'y a ni aidant ni invitation", async () => {
    renderWithProviders(<CaregiversIndexScreen />);

    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });

    expect(screen.getByText(/aucun aidant|no caregiver/i)).toBeTruthy();
  });

  it('affiche une invitation et la révoque au clic', async () => {
    const inv = {
      token: 'tok-abc',
      targetRole: 'contributor' as const,
      displayName: 'Grand-mère',
      createdAtMs: Date.now(),
    };
    mockListInvitations.mockResolvedValue([inv]);

    renderWithProviders(<CaregiversIndexScreen />);

    await waitFor(() => {
      expect(screen.getByText('Grand-mère')).toBeTruthy();
    });

    const revokeButton = screen.getByLabelText(/révoquer|revoke/i);
    fireEvent.press(revokeButton);

    await waitFor(() => {
      expect(mockRevokeInvitation).toHaveBeenCalledWith('tok-abc');
    });

    expect(mockListInvitations).toHaveBeenCalledTimes(2);
  });

  it('navigue vers /caregivers/invite au clic sur "Inviter"', async () => {
    renderWithProviders(<CaregiversIndexScreen />);

    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });

    const inviteButton = screen.getByLabelText(/inviter un aidant|invite a caregiver/i);
    fireEvent.press(inviteButton);

    expect(mockPush).toHaveBeenCalledWith('/caregivers/invite');
  });
});
