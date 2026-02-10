import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function useNFCeStats() {
  return useQuery({
    queryKey: ['nfce-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('nfce')
        .select('status')
        .gte('created_at', thirtyDaysAgo.toISOString());

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
  });
}
