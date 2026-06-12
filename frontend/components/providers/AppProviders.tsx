"use client";

import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { BranchProvider } from "@/components/providers/BranchProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
      <AuthProvider>
        <BranchProvider>
          <NotificationProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                className: "font-sans",
              }}
            />
          </NotificationProvider>
        </BranchProvider>
      </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
