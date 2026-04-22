import { useEffect, type JSX } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/stores/auth-store';

export default function IndexScreen(): JSX.Element | null {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken !== null) {
      router.replace('/journal');
    } else {
      router.replace('/auth');
    }
  }, [accessToken, router]);

  return null;
}
