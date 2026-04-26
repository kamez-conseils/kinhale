import React from 'react';
import { screen, waitFor, fireEvent, act } from '@testing-library/react';
import ResolveConflictPage from '../[doseId]/page';
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
let mockEvents: ReadonlyArray<{ type: string; payloadJson: string }> = [];
jest.mock('@kinhale/sync', () => ({
  projectDoses: () => mockDoses,
  projectCaregivers: () => [],
  VOIDED_REASON_DUPLICATE_RESOLVED: 'duplicate_resolved',
}));

const mockAppendDoseVoid = jest.fn().mockResolvedValue([new Uint8Array([1])]);
jest.mock('../../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { appendDoseVoid: jest.Mock; doc: object }) => unknown) =>
    selector({ appendDoseVoid: mockAppendDoseVoid, doc: { events: mockEvents } }),
  ),
}));

const baseDose = (overrides: Partial<TestDose> = {}): TestDose => ({
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
  eventId: 'evt-A',
  occurredAtMs: 1_000_000,
  deviceId: 'dev-1',
  status: 'pending_review',
  ...overrides,
});

beforeEach(() => {
  mockAppendDoseVoid.mockClear();
  mockDoses = [
    baseDose({ doseId: 'dose-A', eventId: 'evt-A' }),
    baseDose({ doseId: 'dose-B', eventId: 'evt-B', administeredAtMs: 1_060_000 }),
  ];
  mockEvents = [
    {
      type: 'DoseReviewFlagged',
      payloadJson: JSON.stringify({
        flagId: 'flag-1',
        doseIds: ['dose-A', 'dose-B'],
        detectedAtMs: 2_000_000,
      }),
    },
  ];
});

describe('ResolveConflictPage', () => {
  it('affiche les deux doses du conflit', () => {
    renderWithProviders(<ResolveConflictPage />);
    expect(screen.getByTestId('resolve-keep-dose-A')).toBeInTheDocument();
    expect(screen.getByTestId('resolve-keep-dose-B')).toBeInTheDocument();
  });

  it('garde dose-A et void dose-B avec voidedReason="duplicate_resolved"', async () => {
    renderWithProviders(<ResolveConflictPage />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('resolve-keep-dose-A'));
    });
    await waitFor(() => {
      expect(mockAppendDoseVoid).toHaveBeenCalledTimes(1);
    });
    const call = mockAppendDoseVoid.mock.calls[0]?.[0] as {
      doseId: string;
      voidedReason: string;
    };
    expect(call.doseId).toBe('dose-B');
    expect(call.voidedReason).toBe('duplicate_resolved');
  });

  it('garde dose-B et void dose-A symétriquement', async () => {
    renderWithProviders(<ResolveConflictPage />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('resolve-keep-dose-B'));
    });
    await waitFor(() => {
      expect(mockAppendDoseVoid).toHaveBeenCalledTimes(1);
    });
    const call = mockAppendDoseVoid.mock.calls[0]?.[0] as { doseId: string };
    expect(call.doseId).toBe('dose-A');
  });

  it("affiche missingPair si l'événement DoseReviewFlagged n'existe pas", () => {
    mockEvents = [];
    renderWithProviders(<ResolveConflictPage />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
