import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Bus } from "lucide-react";

export default function CTeOS() {
  return (
    <AppLayout title="CT-e OS" subtitle="CT-e Outros Serviços (modelo 67)">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Bus className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Módulo em implantação</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A emissão, consulta, DACTE OS, cancelamento e inutilização de CT-e OS serão liberadas na
            próxima etapa. Nenhum documento é listado aqui ainda.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
