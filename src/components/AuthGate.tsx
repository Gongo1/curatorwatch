"use client";

interface AuthGateProps {
  message: string;
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  return <>{children}</>;
}
