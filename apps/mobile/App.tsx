import type { JSX } from 'react';
import { Providers } from './src/providers';
import HomeScreen from './src/screens/HomeScreen';

export default function App(): JSX.Element {
  return (
    <Providers>
      <HomeScreen />
    </Providers>
  );
}
