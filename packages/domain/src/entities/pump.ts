/**
 * Type de pompe d'asthme. La distinction est structurante pour plusieurs
 * règles :
 * - RM3 : pas de plan de traitement sur une pompe `rescue`.
 * - RM4 : une prise `rescue` exige un symptôme ou une circonstance.
 */
export type PumpType = 'maintenance' | 'rescue';

export type PumpStatus = 'active' | 'low' | 'empty' | 'expired' | 'archived';

export interface Pump {
  readonly id: string;
  readonly householdId: string;
  readonly type: PumpType;
  readonly status: PumpStatus;
  readonly label: string;
  readonly dosesRemaining: number;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}
