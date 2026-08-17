"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { StoreAuthProvider } from "@/components/StoreAuthContext";
import { StoreCartProvider } from "@/components/StoreCartContext";
import { LocationProvider } from "@/components/LocationContext";
import { StoreShell } from "@/components/StoreShell";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      <StoreAuthProvider>
        <StoreCartProvider>
          <LocationProvider>
            <StoreShell>{children}</StoreShell>
            <Toaster richColors position="top-center" />
          </LocationProvider>
        </StoreCartProvider>
      </StoreAuthProvider>
    </QueryClientProvider>
  );
}
