import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import VoidDosePage from '../[doseId]/page';
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
    ) => selector({ accessToken: 'tok', deviceId: 'dev-1', householdId: 'hh-1' }),
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
  VOIDED_REASON_MAX_LENGTH: 200,
}));

const mockAppendDoseVoid = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendDoseVoid: jest.Mock; doc: object }) => unknown) =>
    selector({ appendDoseVoid: mockAppendDoseVoid, doc: { events: [] } }),
  ),
}));

beforeEach(() => {
  mockAppendDoseVoid.mockClear();
  mockDoses = [
    {
      doseId: 'dose-A',
      pumpId: 'pump-1',
      childId: 'child-1',
      caregiverId: 'dev-1',
      administeredAtMs: 1_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
      eventId: 'evt-1',
      occurredAtMs: 1_000_000,
      deviceId: 'dev-1',
      status: 'recorded',
    },
  ];
});

describe('VoidDosePage', () => {
  it('refuse de poster sans raison', async () => {
    renderWithProviders(<VoidDosePage />);
    await waitFor(() => {
      expect(screen.getByTestId('void-submit')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('void-submit'));
    });
    expect(mockAppendDoseVoid).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('soumet le DoseVoided avec la raison saisie', async () => {
    renderWithProviders(<VoidDosePage />);
    await waitFor(() => {
      expect(screen.getByTestId('void-reason')).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('void-reason'), {
        target: { value: 'mauvaise pompe' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('void-submit'));
    });
    await waitFor(() => {
      expect(mockAppendDoseVoid).toHaveBeenCalledTimes(1);
    });
    const call = mockAppendDoseVoid.mock.calls[0]?.[0] as {
      doseId: string;
      voidedReason: string;
      voidedByDeviceId: string;
    };
    expect(call.doseId).toBe('dose-A');
    expect(call.voidedReason).toBe('mauvaise pompe');
    expect(call.voidedByDeviceId).toBe('dev-1');
  });

  it('affiche un message si la dose est déjà voidée', async () => {
    mockDoses = [{ ...mockDoses[0]!, status: 'voided' }];
    renderWithProviders(<VoidDosePage />);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('void-submit')).not.toBeInTheDocument();
  });
});
