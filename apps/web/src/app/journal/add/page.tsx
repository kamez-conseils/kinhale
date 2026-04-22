'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { YStack, H1, Button, Text, XStack, Input } from 'tamagui';
import { useAuthStore } from '../../../stores/auth-store';
import { useDocStore } from '../../../stores/doc-store';
import { getOrCreateDevice, getGroupKey } from '../../../lib/device';
import { useRelay } from '../../../hooks/use-relay';

const SYMPTOMS = ['cough', 'wheezing', 'shortness_of_breath', 'chest_tightness'] as const;
const CIRCUMSTANCES = ['exercise', 'allergen', 'cold_air', 'night', 'infection', 'stress'] as const;

type Symptom = (typeof SYMPTOMS)[number];
type Circumstance = (typeof CIRCUMSTANCES)[number];

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export default function AddDosePage(): React.JSX.Element {
  const { t } = useTranslation('common');
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const deviceId = useAuthStore((s) => s.deviceId) ?? '';
  const householdId = useAuthStore((s) => s.householdId) ?? '';
  const appendDose = useDocStore((s) => s.appendDose);

  const [doseType, setDoseType] = useState<'maintenance' | 'rescue'>('maintenance');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [circumstances, setCircumstances] = useState<Circumstance[]>([]);
  const [freeFormTag, setFreeFormTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (householdId !== '') {
      getGroupKey(householdId)
        .then(setGroupKey)
        .catch(() => undefined);
    }
  }, [householdId]);

  const { sendChanges } = useRelay(accessToken, groupKey);

  const validate = (): boolean => {
    if (doseType === 'rescue') {
      const hasContext =
        symptoms.length > 0 || circumstances.length > 0 || freeFormTag.trim() !== '';
      if (!hasContext) {
        setError(t('journal.rescueNeedsContext'));
        return false;
      }
    }
    return true;
  };

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const kp = await getOrCreateDevice();
      const payload = {
        doseId: crypto.randomUUID(),
        pumpId: 'default-pump', // TODO(KIN-035): remplacer par pumpId sélectionné depuis le doc
        childId: 'default-child', // TODO(KIN-035): remplacer par childId depuis le doc (RM13 un enfant/foyer)
        caregiverId: deviceId, // TODO(KIN-035): caregiverId = userId, pas deviceId
        administeredAtMs: Date.now(),
        doseType,
        dosesAdministered: 1,
        symptoms: [...symptoms],
        circumstances: [...circumstances],
        freeFormTag: freeFormTag.trim() !== '' ? freeFormTag.trim() : null,
      };
      const changes = await appendDose(payload, deviceId, kp.secretKey);
      if (groupKey !== null) {
        await sendChanges(changes, groupKey);
      }
      router.push('/journal');
    } catch {
      setError(t('journal.saveError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <YStack padding="$4" gap="$4">
      <H1>{t('journal.addTitle')}</H1>

      <Text fontWeight="600">{t('journal.doseType')}</Text>
      <XStack gap="$3">
        <Button
          flex={1}
          onPress={() => {
            setDoseType('maintenance');
            setError(null);
          }}
          theme={doseType === 'maintenance' ? 'active' : null}
        >
          {t('journal.maintenance')}
        </Button>
        <Button
          flex={1}
          onPress={() => {
            setDoseType('rescue');
            setError(null);
          }}
          theme={doseType === 'rescue' ? 'active' : null}
        >
          {t('journal.rescue')}
        </Button>
      </XStack>

      <Text fontWeight="600">{t('journal.symptoms')}</Text>
      <XStack flexWrap="wrap" gap="$2">
        {SYMPTOMS.map((s) => (
          <Button
            key={s}
            size="$3"
            onPress={() => { setSymptoms((prev) => toggle(prev, s)); setError(null); }}
            theme={symptoms.includes(s) ? 'active' : null}
          >
            {t(`journal.symptom.${s}`)}
          </Button>
        ))}
      </XStack>

      <Text fontWeight="600">{t('journal.circumstances')}</Text>
      <XStack flexWrap="wrap" gap="$2">
        {CIRCUMSTANCES.map((c) => (
          <Button
            key={c}
            size="$3"
            onPress={() => { setCircumstances((prev) => toggle(prev, c)); setError(null); }}
            theme={circumstances.includes(c) ? 'active' : null}
          >
            {t(`journal.circumstance.${c}`)}
          </Button>
        ))}
      </XStack>

      <Text fontWeight="600">{t('journal.freeFormTag')}</Text>
      <Input
        value={freeFormTag}
        onChangeText={(text) => { setFreeFormTag(text); setError(null); }}
        placeholder={t('journal.freeFormTagPlaceholder')}
      />

      {error !== null && (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      )}

      <Button onPress={() => void handleSave()} disabled={loading} marginTop="$2">
        {loading ? t('journal.saving') : t('journal.save')}
      </Button>
    </YStack>
  );
}
