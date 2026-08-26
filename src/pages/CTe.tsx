import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { PackageCheck } from "lucide-react";

export default function CTe() {
  return (
    <AppLayout title="CT-e" subtitle="Conhecimento de Transporte Eletrônico (modelo 57)">
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <PackageCheck className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Módulo em implantação</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            A emissão, consulta, DACTE, cancelamento e inutilização de CT-e serão liberadas na
            próxima etapa. Nenhum documento é listado aqui ainda.
          </p>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
