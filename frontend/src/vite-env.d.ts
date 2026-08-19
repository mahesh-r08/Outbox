/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_DEFAULT_SMTP_HOST?: string;
  readonly VITE_DEFAULT_SMTP_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
