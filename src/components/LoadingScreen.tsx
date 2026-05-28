import type { ReactNode } from 'react';

type Props = {
  message?: string;
  auth?: boolean;
  children?: ReactNode;
};

export function LoadingScreen({ message = 'Loading BU Scheduler…', auth = false, children }: Props) {
  return (
    <div className={`loading-screen ${auth ? 'loading-screen--auth' : ''}`} aria-live="polite" aria-busy="true">
      <div className="spinner" />
      <p>{message}</p>
      {children}
    </div>
  );
}

export default LoadingScreen;
