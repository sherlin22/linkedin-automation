// src/types/global.d.ts
// Only declare truly untyped third-party or local JS modules.
// DO NOT declare packages that ship their own types (radix, recharts, react-hook-form, class-variance-authority, embla, etc).

declare module "input-otp";
declare module "vaul";

// local JS modules: declare the real exports here (preferred) instead of wildcard modules.
// Example for a utils file that exports `cn`:
declare module "@/lib/utils" {
  export function cn(...classes: Array<string | false | null | undefined>): string;
}

// Local hooks that might be JS - declare minimal API (adjust if your actual exports differ)
declare module "@/hooks/use-toast" {
  export function useToast(...args: any[]): any;
  export const toast: any;
}
declare module "@/hooks/use-mobile" {
  export function useIsMobile(): boolean;
}
declare module "cmdk";
