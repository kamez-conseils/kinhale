import * as React from 'react';
import { Stack, Text, Theme, XStack, YStack } from 'tamagui';

import { AddPumpPreview } from './AddPumpPreview';
import { AddPumpStep1 } from './AddPumpStep1';
import { AddPumpStep2 } from './AddPumpStep2';
import { AddPumpStep3 } from './AddPumpStep3';
import { AddPumpStep4 } from './AddPumpStep4';
import { CloseIcon } from './icons';
import { Stepper } from './Stepper';
import type { AddPumpFormState, AddPumpHandlers, AddPumpMessages, AddPumpStepIndex } from './types';

export interface AddPumpFlowProps {
  messages: AddPumpMessages;
  /** État du formulaire en mode contrôlé. */
  state: AddPumpFormState;
  onChange: (patch: Partial<AddPumpFormState>) => void;
  /** Étape courante en mode contrôlé. */
  step: AddPumpStepIndex;
  onStepChange: (s: AddPumpStepIndex) => void;
  handlers?: AddPumpHandlers | undefined;
  /** Mode visuel : `mobile` => écran plein, `web` => modal 880×720 + aperçu. */
  mode?: 'mobile' | 'web';
  onPressScan?: (() => void) | undefined;
  theme?: 'kinhale_light' | 'kinhale_dark';
}

export function AddPumpFlow({
  messages,
  state,
  onChange,
  step,
  onStepChange,
  handlers,
  mode = 'mobile',
  onPressScan,
  theme = 'kinhale_light',
}: AddPumpFlowProps): React.JSX.Element {
  const isWeb = mode === 'web';

  const stepEl = (() => {
    switch (step) {
      case 0:
        return (
          <AddPumpStep1
            messages={messages.step1}
            state={state}
            onChange={onChange}
            {...(onPressScan ? { onPressScan } : {})}
          />
        );
      case 1:
        return <AddPumpStep2 messages={messages.step2} state={state} onChange={onChange} />;
      case 2:
        return <AddPumpStep3 messages={messages.step3} state={state} onChange={onChange} />;
      case 3:
      default:
        return (
          <AddPumpStep4 messages={messages.step4} step2Messages={messages.step2} state={state} />
        );
    }
  })();

  const inner = (
    <YStack flex={1} minHeight={0}>
      <YStack
        paddingHorizontal={isWeb ? 28 : 18}
        paddingTop={isWeb ? 20 : 14}
        paddingBottom={isWeb ? 16 : 12}
        borderBottomWidth={0.5}
        borderBottomColor="$borderColor"
      >
        <XStack alignItems="center" justifyContent="space-between" marginBottom={14}>
          <Text fontFamily="$heading" fontSize={isWeb ? 18 : 16} fontWeight="600" color="$color">
            {messages.modalTitle}
          </Text>
          {isWeb && handlers?.onCancel && (
            <Stack
              tag="button"
              cursor="pointer"
              padding={4}
              borderWidth={0}
              backgroundColor="transparent"
              onPress={handlers.onCancel}
              accessibilityRole="button"
              accessibilityLabel={messages.cancel}
            >
              <Text color="$colorMore" display="flex">
                <CloseIcon size={18} color="currentColor" />
              </Text>
            </Stack>
          )}
        </XStack>
        <Stepper steps={messages.stepShort} active={step} />
      </YStack>

      <Stack
        flex={1}
        paddingHorizontal={isWeb ? 28 : 18}
        paddingVertical={isWeb ? 24 : 20}
        style={{ overflow: 'auto' }}
      >
        {stepEl}
      </Stack>

      <FooterBar
        step={step}
        messages={messages}
        isWeb={isWeb}
        onStepChange={onStepChange}
        {...(handlers ? { handlers } : {})}
        state={state}
      />
    </YStack>
  );

  if (isWeb) {
    return (
      <Theme name={theme}>
        <Stack
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          alignItems="center"
          justifyContent="center"
          padding={24}
          backgroundColor="$surface2"
        >
          <Stack
            width={880}
            height={720}
            maxWidth="100%"
            maxHeight="100%"
            backgroundColor="$surface"
            borderRadius={18}
            overflow="hidden"
            style={{
              boxShadow: '0 30px 80px rgba(0,0,0,0.28)',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
            }}
          >
            <YStack flex={1} overflow="hidden">
              {inner}
            </YStack>
            <AddPumpPreview messages={messages} state={state} />
          </Stack>
        </Stack>
      </Theme>
    );
  }

  return (
    <Theme name={theme}>
      <YStack height="100%" backgroundColor="$background">
        {inner}
      </YStack>
    </Theme>
  );
}

function FooterBar({
  step,
  messages,
  isWeb,
  onStepChange,
  handlers,
  state,
}: {
  step: AddPumpStepIndex;
  messages: AddPumpMessages;
  isWeb: boolean;
  onStepChange: (s: AddPumpStepIndex) => void;
  handlers?: AddPumpHandlers | undefined;
  state: AddPumpFormState;
}): React.JSX.Element {
  const next = (): void => {
    const n = (step + 1) as AddPumpStepIndex;
    if (n === 3) {
      handlers?.onSubmit?.(state);
    }
    onStepChange(n);
  };
  const back = (): void => onStepChange((step - 1) as AddPumpStepIndex);

  return (
    <XStack
      paddingHorizontal={isWeb ? 28 : 18}
      paddingVertical={isWeb ? 14 : 12}
      borderTopWidth={0.5}
      borderTopColor="$borderColor"
      backgroundColor="$surface"
      gap={8}
      alignItems="center"
    >
      {step === 0 && handlers?.onCancel && (
        <Stack
          tag="button"
          cursor="pointer"
          paddingHorizontal={16}
          paddingVertical={10}
          borderRadius={10}
          borderWidth={0}
          backgroundColor="transparent"
          onPress={handlers.onCancel}
          accessibilityRole="button"
        >
          <Text fontSize={13} fontWeight="500" color="$colorMore">
            {messages.cancel}
          </Text>
        </Stack>
      )}
      {step > 0 && step < 3 && (
        <Stack
          tag="button"
          cursor="pointer"
          paddingHorizontal={16}
          paddingVertical={10}
          borderRadius={10}
          borderWidth={0.5}
          borderColor="$borderColorStrong"
          backgroundColor="$surface"
          onPress={back}
          accessibilityRole="button"
        >
          <Text fontSize={13} fontWeight="500" color="$color">
            {messages.back}
          </Text>
        </Stack>
      )}
      <Stack flex={1} />
      {step < 2 && (
        <Stack
          tag="button"
          cursor="pointer"
          paddingHorizontal={22}
          paddingVertical={11}
          borderRadius={10}
          borderWidth={0}
          backgroundColor="$maint"
          onPress={next}
          accessibilityRole="button"
        >
          <Text fontSize={13} fontWeight="600" color="white">
            {messages.next}
          </Text>
        </Stack>
      )}
      {step === 2 && (
        <Stack
          tag="button"
          cursor="pointer"
          paddingHorizontal={22}
          paddingVertical={11}
          borderRadius={10}
          borderWidth={0}
          backgroundColor="$maint"
          onPress={next}
          accessibilityRole="button"
        >
          <Text fontSize={13} fontWeight="600" color="white">
            {messages.save}
          </Text>
        </Stack>
      )}
      {step === 3 && (
        <>
          {handlers?.onLogFirstDose && (
            <Stack
              tag="button"
              cursor="pointer"
              paddingHorizontal={16}
              paddingVertical={10}
              borderRadius={10}
              borderWidth={0.5}
              borderColor="$borderColorStrong"
              backgroundColor="$surface"
              onPress={() => handlers.onLogFirstDose?.(state)}
              accessibilityRole="button"
            >
              <Text fontSize={13} fontWeight="500" color="$color">
                {messages.step4.firstDoseCta}
              </Text>
            </Stack>
          )}
          {handlers?.onCancel && (
            <Stack
              tag="button"
              cursor="pointer"
              paddingHorizontal={22}
              paddingVertical={11}
              borderRadius={10}
              borderWidth={0}
              backgroundColor="$maint"
              onPress={handlers.onCancel}
              accessibilityRole="button"
            >
              <Text fontSize={13} fontWeight="600" color="white">
                {messages.step4.doneCta}
              </Text>
            </Stack>
          )}
        </>
      )}
    </XStack>
  );
}
