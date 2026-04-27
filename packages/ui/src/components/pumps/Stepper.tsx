import * as React from 'react';
import { Stack, Text, XStack } from 'tamagui';

import { CheckIcon } from '../../icons';

export interface StepperProps {
  steps: ReadonlyArray<string>;
  active: number;
}

export function Stepper({ steps, active }: StepperProps): React.JSX.Element {
  return (
    <XStack alignItems="center" gap={6} flexWrap="wrap">
      {steps.map((label, i) => {
        const done = i < active;
        const cur = i === active;
        const isLast = i === steps.length - 1;
        return (
          <React.Fragment key={i}>
            <XStack alignItems="center" gap={6}>
              <Text
                fontFamily="$mono"
                width={20}
                height={20}
                borderRadius={10}
                backgroundColor={done || cur ? '$maint' : '$surface2'}
                color={done || cur ? 'white' : '$colorMore'}
                borderWidth={0.5}
                borderColor={done || cur ? '$maint' : '$borderColorStrong'}
                alignItems="center"
                justifyContent="center"
                fontSize={10.5}
                fontWeight="600"
                display="flex"
              >
                {done ? <CheckIcon size={11} color="currentColor" /> : i + 1}
              </Text>
              <Text
                fontSize={11.5}
                color={cur ? '$color' : '$colorMore'}
                fontWeight={cur ? '600' : '500'}
              >
                {label}
              </Text>
            </XStack>
            {!isLast && (
              <Stack
                flex={1}
                height={1}
                minWidth={12}
                backgroundColor={i < active ? '$maint' : '$borderColor'}
              />
            )}
          </React.Fragment>
        );
      })}
    </XStack>
  );
}
