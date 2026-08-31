const DEV_EMAIL = import.meta.env.VITE_DEV_EMAIL ?? "dev@feeana.me";

export const isDevEmail = (email?: string | null) =>
  !!email && email.trim().toLowerCase() === DEV_EMAIL.toLowerCase();
