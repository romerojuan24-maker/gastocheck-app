// Redirect al módulo principal de viáticos
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function ViaticosRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/viaticos' as any); }, []);
  return null;
}
