'use client';

import dynamic from 'next/dynamic';

const StationScene = dynamic(() => import('@/components/StationScene'), {
  ssr: false,
});

export default function StationPage() {
  return <StationScene />;
}
