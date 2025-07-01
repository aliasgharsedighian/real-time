/// <reference types="vite/client" />
interface ImportMetaEnv {
  VITE_API_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
