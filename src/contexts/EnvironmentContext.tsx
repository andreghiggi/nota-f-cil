import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Ambiente = "producao" | "homologacao" | "todos";

interface EnvironmentContextValue {
  ambiente: Ambiente;
  setAmbiente: (a: Ambiente) => void;
}

const EnvironmentContext = createContext<EnvironmentContextValue | undefined>(undefined);

const STORAGE_KEY = "nfce.ambiente";

export function EnvironmentProvider({ children }: { children: ReactNode }) {
  const [ambiente, setAmbienteState] = useState<Ambiente>(() => {
    if (typeof window === "undefined") return "producao";
    const saved = localStorage.getItem(STORAGE_KEY) as Ambiente | null;
    return saved && ["producao", "homologacao", "todos"].includes(saved) ? saved : "producao";
  });

  const setAmbiente = (a: Ambiente) => {
    setAmbienteState(a);
    try {
      localStorage.setItem(STORAGE_KEY, a);
    } catch {}
  };

  useEffect(() => {
    document.documentElement.dataset.ambiente = ambiente;
  }, [ambiente]);

  return (
    <EnvironmentContext.Provider value={{ ambiente, setAmbiente }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) throw new Error("useEnvironment must be used within EnvironmentProvider");
  return ctx;
}
