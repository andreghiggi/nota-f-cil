import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useNFCeStats(ambiente: 'producao' | 'homologacao' | 'todos' = 'todos') {
  return useQuery({
    queryKey: ['nfce-stats', ambiente],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let query = supabase
        .from('nfce')
        .select('status, ambiente')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (ambiente !== 'todos') {
        query = query.eq('ambiente', ambiente);
      }

      const { data, error } = await query;
      if (error) throw error;

      const statusCounts: Record<string, number> = {};
      (data || []).forEach(n => {
        statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
      });

      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));
    },
    refetchInterval: 30000,
  });
}
