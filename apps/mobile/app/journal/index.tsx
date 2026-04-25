import React, { useEffect, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Text, Button, XStack } from 'tamagui';
import { projectDoses, projectCaregivers, type ProjectedDose } from '@kinhale/sync';
import { canEditDose } from '@kinhale/domain/entities';
import type { Role } from '@kinhale/domain/entities';
import { useAuthStore } from '../../src/stores/auth-store';
import { useDocStore } from '../../src/stores/doc-store';

function deriveCurrentRole(
  caregivers: ReadonlyArray<{ caregiverId: string; role: string }>,
  deviceId: string | null,
): Role {
  if (deviceId === null) return 'contributor';
  const me = caregivers.find((c) => c.caregiverId === deviceId);
  if (me === undefined) return 'contributor';
  if (me.role === 'admin' || me.role === 'restricted_contributor' || me.role === 'contributor') {
    return me.role;
  }
  return 'contributor';
}

export default function JournalScreen(): JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const householdId = useAuthStore((s) => s.householdId);
  const deviceId = useAuthStore((s) => s.deviceId);
  const doc = useDocStore((s) => s.doc);
  const initDoc = useDocStore((s) => s.initDoc);

  useEffect(() => {
    if (accessToken === null) {
      router.replace('/auth');
      return;
    }
    if (householdId !== null) {
      void initDoc(householdId);
    }
  }, [accessToken, householdId, initDoc, router]);

  const doses = doc !== null ? projectDoses(doc) : [];
  const caregivers = doc !== null ? projectCaregivers(doc) : [];
  const currentRole = deriveCurrentRole(caregivers, deviceId);
  const nowMs = Date.now();

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.title')}</H1>
      {doses.length === 0 && <Text color="$color10">{t('journal.empty')}</Text>}
      {doses.map((dose) => {
        const isVoided = dose.status === 'voided';
        const isPendingReview = dose.status === 'pending_review';
        const editVerdict = canEditDose({
          dose: {
            recordedByDeviceId: dose.deviceId,
            administeredAtMs: dose.administeredAtMs,
            status: dose.status,
          },
          currentDeviceId: deviceId ?? '',
          currentRole,
          nowMs,
        });
        return (
          <DoseCard
            key={dose.eventId}
            dose={dose}
            isVoided={isVoided}
            isPendingReview={isPendingReview}
            canEdit={editVerdict.allowed}
            t={t}
            onEdit={() =>
              router.push({ pathname: '/journal/edit/[doseId]', params: { doseId: dose.doseId } })
            }
            onVoid={() =>
              router.push({ pathname: '/journal/void/[doseId]', params: { doseId: dose.doseId } })
            }
            onResolve={() =>
              router.push({
                pathname: '/journal/resolve/[doseId]',
                params: { doseId: dose.doseId },
              })
            }
          />
        );
      })}
      <Button
        onPress={() => router.push('/journal/add')}
        marginTop="$2"
        accessible
        accessibilityRole="button"
      >
        {t('journal.addDose')}
      </Button>
    </YStack>
  );
}

interface DoseCardProps {
  readonly dose: ProjectedDose;
  readonly isVoided: boolean;
  readonly isPendingReview: boolean;
  readonly canEdit: boolean;
  readonly t: (key: string) => string;
  readonly onEdit: () => void;
  readonly onVoid: () => void;
  readonly onResolve: () => void;
}

function DoseCard({
  dose,
  isVoided,
  isPendingReview,
  canEdit,
  t,
  onEdit,
  onVoid,
  onResolve,
}: DoseCardProps): JSX.Element {
  const labelKey = dose.doseType === 'rescue' ? 'journal.rescue' : 'journal.maintenance';
  const reasonLabel =
    isVoided && dose.voidedReason !== undefined && dose.voidedReason === 'duplicate_resolved'
      ? t('journal.dose.voidedReason.duplicate_resolved')
      : (dose.voidedReason ?? '');
  return (
    <YStack
      padding="$3"
      borderWidth={1}
      borderColor={isPendingReview ? '$orange8' : '$borderColor'}
      borderRadius="$3"
      gap="$2"
      opacity={isVoided ? 0.55 : 1}
      backgroundColor={isPendingReview ? '$orange3' : '$background'}
    >
      <XStack justifyContent="space-between" alignItems="center">
        <Text
          fontSize="$4"
          fontWeight="700"
          textDecorationLine={isVoided ? 'line-through' : 'none'}
        >
          {t(labelKey)}
        </Text>
        <Text fontSize="$2" color="$color9">
          {new Date(dose.administeredAtMs).toLocaleString()}
        </Text>
      </XStack>

      {isVoided && (
        <Text fontSize="$2" color="$color10" fontWeight="600">
          {t('journal.dose.voidedBadge')}
          {reasonLabel.length > 0 && ` · ${t('journal.dose.voidedReason.label')} : ${reasonLabel}`}
        </Text>
      )}

      {isPendingReview && (
        <Text fontSize="$2" color="$orange11" fontWeight="600">
          {t('journal.dose.pendingReviewBadge')}
        </Text>
      )}

      {dose.symptoms.length > 0 && (
        <Text fontSize="$3" color="$color10">
          {dose.symptoms.map((s) => t(`journal.symptom.${s}`)).join(' · ')}
        </Text>
      )}

      {dose.circumstances.length > 0 && (
        <Text fontSize="$3" color="$color10">
          {dose.circumstances.map((c) => t(`journal.circumstance.${c}`)).join(' · ')}
        </Text>
      )}

      {dose.freeFormTag !== null && (
        <Text fontSize="$3" color="$color9" fontStyle="italic">
          {dose.freeFormTag}
        </Text>
      )}

      {!isVoided && (
        <XStack gap="$2" flexWrap="wrap" marginTop="$2">
          {canEdit && (
            <Button size="$2" onPress={onEdit} accessible accessibilityRole="button">
              {t('journal.dose.actions.edit')}
            </Button>
          )}
          <Button size="$2" onPress={onVoid} theme="red" accessible accessibilityRole="button">
            {t('journal.dose.actions.void')}
          </Button>
          {isPendingReview && (
            <Button
              size="$2"
              onPress={onResolve}
              theme="orange"
              accessible
              accessibilityRole="button"
            >
              {t('journal.dose.actions.resolve')}
            </Button>
          )}
        </XStack>
      )}
    </YStack>
  );
}
