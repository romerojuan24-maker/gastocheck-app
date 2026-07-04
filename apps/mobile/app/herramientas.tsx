import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function HerramientasScreen() {
  const router = useRouter();
  useEffect(() => { router.replace('/gastocheck' as any); }, []);
  return null;
}
