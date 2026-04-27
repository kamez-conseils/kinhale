import * as React from 'react';
import { Text, YStack } from 'tamagui';

export interface FieldProps {
  label: string;
  helper?: string;
  /** ID stable utilisé pour relier `<label htmlFor>` au champ (a11y). */
  htmlFor?: string;
  children: React.ReactNode;
  /** Si vrai, occupe toute la largeur d'un grid parent. */
  full?: boolean;
}

export function Field({ label, helper, htmlFor, children, full }: FieldProps): React.JSX.Element {
  return (
    <YStack gap={6} {...(full ? { style: { gridColumn: '1 / -1' } } : {})}>
      <Text
        tag="label"
        fontSize={11}
        color="$colorMore"
        textTransform="uppercase"
        letterSpacing={0.66}
        fontWeight="600"
        {...(htmlFor ? { htmlFor } : {})}
      >
        {label}
      </Text>
      {children}
      {helper && (
        <Text fontSize={11} color="$colorMore">
          {helper}
        </Text>
      )}
    </YStack>
  );
}

export const inputBaseStyle: React.CSSProperties = {
  appearance: 'none',
  width: '100%',
  padding: '11px 13px',
  borderRadius: 10,
  border: '0.5px solid var(--borderColorStrong)',
  background: 'var(--surface)',
  color: 'var(--color)',
  fontSize: 13.5,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};
