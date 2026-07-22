import { useMemo } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { Building2 } from 'lucide-react';
import { useAuth } from '@living/hooks';
import { listContainer } from '@living/ui/motion';
import { EmptyState, ErrorState, PageContainer } from '@living/ui';

import { useCommunity } from '../community/community-context';
import {
  buildActivity, buildAttention, buildMyWork, computeHealth, computeKpis, groupActivity,
} from './derive';
import { useDashboardData } from './queries';
import { Hero } from './sections/hero';
import { QuickActions } from './sections/quick-actions';
import { TodaysOperations } from './sections/todays-operations';
import { AttentionRequired } from './sections/attention-required';
import { RecentActivity } from './sections/recent-activity';
import { CommunityHealth } from './sections/community-health';
import { MyWork } from './sections/my-work';

/**
 * The Operations Dashboard — the control center. Composes the data layer
 * (SDK + Query) with pure derivations and the section components. One responsive
 * layout; motion respects reduced-motion via MotionConfig; permission-aware
 * throughout.
 */
export function DashboardPage() {
  const { session } = useAuth();
  const { community, communityId, isLoading: communityLoading } = useCommunity();
  const data = useDashboardData(communityId);

  const userId = session?.user.id ?? '';
  const canVerify = useMemo(
    () => (session?.permissions ?? []).includes('workorder:verify'),
    [session?.permissions],
  );

  const derived = useMemo(() => {
    const kpis = computeKpis({ summary: data.summary, serviceRequests: data.serviceRequests, workOrders: data.workOrders });
    const attention = buildAttention({ tickets: data.tickets, serviceRequests: data.serviceRequests, workOrders: data.workOrders });
    const activity = groupActivity(
      buildActivity({ tickets: data.tickets, serviceRequests: data.serviceRequests, workOrders: data.workOrders, residents: data.residents }),
    );
    const health = computeHealth({
      summary: data.summary, serviceRequests: data.serviceRequests, workOrders: data.workOrders,
      totalUnits: data.community?.statistics?.units, occupiedUnits: data.occupiedUnits,
    });
    const myWork = buildMyWork({ userId, canVerify, tickets: data.tickets, serviceRequests: data.serviceRequests, workOrders: data.workOrders });
    return { kpis, attention, activity, health, myWork };
  }, [data, userId, canVerify]);

  // No community to operate on (e.g. a fresh tenant).
  if (!communityLoading && !communityId) {
    return (
      <PageContainer>
        <EmptyState
          icon={Building2}
          title="No community yet"
          description="Once a community is set up, your operations dashboard appears here."
        />
      </PageContainer>
    );
  }

  if (data.isError) {
    return (
      <PageContainer>
        <Hero firstName={session?.user.firstName} communityName={community?.name} />
        <ErrorState error={data.error} onRetry={data.refetch} />
      </PageContainer>
    );
  }

  const loading = communityLoading || data.isLoading;

  return (
    <MotionConfig reducedMotion="user">
      <PageContainer>
        <Hero firstName={session?.user.firstName} communityName={community?.name} />

        <motion.div variants={listContainer} initial="initial" animate="animate">
          <QuickActions />
          <TodaysOperations kpis={derived.kpis} loading={loading} />
          <AttentionRequired groups={derived.attention} loading={loading} />

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivity buckets={derived.activity} loading={loading} />
            <div>
              <CommunityHealth health={derived.health} loading={loading} />
              <MyWork work={derived.myWork} loading={loading} />
            </div>
          </div>
        </motion.div>
      </PageContainer>
    </MotionConfig>
  );
}
