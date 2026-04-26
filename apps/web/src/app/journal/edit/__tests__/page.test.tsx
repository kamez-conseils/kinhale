import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import EditDosePage from '../[doseId]/page';
import { renderWithProviders } from '../../../../test-utils/render';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useParams: () => ({ doseId: 'dose-A' }),
}));

jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        deviceId: string | null;
        householdId: string | null;
      }) => unknown,
    ) => selector({ accessToken: 'tok', deviceId: 'dev-author', householdId: 'hh-1' }),
  ),
}));

jest.mock('../../../../lib/useRequireAuth', () => ({
  useRequireAuth: () => true,
}));

jest.mock('../../../../lib/device', () => ({
  getOrCreateDevice: jest.fn().mockResolvedValue({
    publicKey: new Uint8Array(32),
    secretKey: new Uint8Array(64),
    publicKeyHex: 'a'.repeat(64),
  }),
  getGroupKey: jest.fn().mockResolvedValue(new Uint8Array(32)),
}));

const mockSendChanges = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../hooks/use-relay', () => ({
  useRelay: () => ({ sendChanges: mockSendChanges }),
}));

interface TestDose {
  doseId: string;
  pumpId: string;
  childId: string;
  caregiverId: string;
  administeredAtMs: number;
  doseType: 'maintenance' | 'rescue';
  dosesAdministered: number;
  symptoms: ReadonlyArray<string>;
  circumstances: ReadonlyArray<string>;
  freeFormTag: string | null;
  eventId: string;
  occurredAtMs: number;
  deviceId: string;
  status: 'recorded' | 'pending_review' | 'voided';
}

let mockDoses: TestDose[] = [];
jest.mock('@kinhale/sync', () => ({
  projectDoses: () => mockDoses,
  projectCaregivers: () => [],
  VOIDED_REASON_MAX_LENGTH: 200,
}));

const mockAppendDoseEdit = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendDoseEdit: jest.Mock; doc: object }) => unknown) =>
    selector({ appendDoseEdit: mockAppendDoseEdit, doc: { events: [] } }),
  ),
}));

const NOW = 1_700_000_000_000;

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  mockAppendDoseEdit.mockClear();
  mockSendChanges.mockClear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockDoses = [
    {
      doseId: 'dose-A',
      pumpId: 'pump-1',
      childId: 'child-1',
      caregiverId: 'dev-author',
      administeredAtMs: NOW - 5 * 60_000, // 5 min before now → editable
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
      eventId: 'evt-1',
      occurredAtMs: NOW - 5 * 60_000,
      deviceId: 'dev-author',
      status: 'recorded',
    },
  ];
});

describe('EditDosePage', () => {
  it("refuse l'édition pour un contributor non-auteur > 30 min", async () => {
    mockDoses = [
      {
        ...mockDoses[0]!,
        deviceId: 'dev-other',
        administeredAtMs: NOW - 60 * 60_000,
        occurredAtMs: NOW - 60 * 60_000,
      },
    ];
    renderWithProviders(<EditDosePage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it("autorise l'édition de l'auteur dans les 30 minutes", async () => {
    renderWithProviders(<EditDosePage />);
    await waitFor(() => {
      expect(screen.getByTestId('edit-submit')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('edit-reason')).not.toBeInTheDocument();
  });

  it('appendDoseEdit appelé avec les patches au submit', async () => {
    renderWithProviders(<EditDosePage />);
    await waitFor(() => {
      expect(screen.getByTestId('edit-submit')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-submit'));
    });
    await waitFor(() => {
      expect(mockAppendDoseEdit).toHaveBeenCalledTimes(1);
    });
    const call = mockAppendDoseEdit.mock.calls[0]?.[0] as {
      doseId: string;
      patch: { dosesAdministered?: number };
      editedByDeviceId: string;
    };
    expect(call.doseId).toBe('dose-A');
    expect(call.editedByDeviceId).toBe('dev-author');
  });

  it("affiche un champ raison obligatoire pour Admin > 30 min (refus en l'état contributor)", async () => {
    mockDoses = [
      {
        ...mockDoses[0]!,
        administeredAtMs: NOW - 60 * 60_000,
        occurredAtMs: NOW - 60 * 60_000,
        deviceId: 'dev-author', // auteur
      },
    ];
    // contributor non-admin → refus (cas hors fenêtre, non-Admin)
    renderWithProviders(<EditDosePage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
