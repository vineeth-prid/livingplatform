import { useQueries } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Download, FileText, Megaphone, PhoneCall, Sparkles } from 'lucide-react';
import { Can } from '@living/hooks';
import { timeAgo } from '@living/utils';
import { Badge, type BadgeProps, Card, EmptyState, Skeleton } from '@living/ui';

import { useResidentCommunity } from '../community';
import { useAnnouncements } from '../community-ops';
import { living } from '../lib/living';
import { ListCard, Section, SoftPlaceholder } from '../components';
import { ScreenHeader } from '../shell';

interface EmergencyContact { name: string; role?: string; phone: string }

const PRIORITY_TONE: Record<string, NonNullable<BadgeProps['tone']>> = {
  LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', CRITICAL: 'danger',
};

export function CommunityScreen() {
  const { community, communityId } = useResidentCommunity();
  const announcementsQuery = useAnnouncements();
  const announcements = announcementsQuery.data?.items ?? [];

  const [amenities, documents] = useQueries({
    queries: [
      { queryKey: ['amenities', communityId], queryFn: () => living.community.listAmenities(communityId!, { limit: 50 }), enabled: !!communityId },
      { queryKey: ['documents', communityId], queryFn: () => living.community.listDocuments(communityId!, { limit: 50 }), enabled: !!communityId },
    ],
  });

  const contacts = (community?.emergencyContacts as EmergencyContact[] | undefined) ?? [];

  return (
    <div>
      <ScreenHeader title="Community" subtitle={community?.name} />
      <div className="px-4">
        <Section
          title="Announcements"
          action={
            announcements.length > 0 ? (
              <Link to={'/announcements' as string} className="text-sm text-brand">See all</Link>
            ) : undefined
          }
        >
          {announcementsQuery.isLoading ? (
            <Skeleton className="h-20 rounded-card" />
          ) : announcements.length === 0 ? (
            <SoftPlaceholder icon={Megaphone} title="Nothing new" note="Notices from your association appear here." />
          ) : (
            <div className="flex flex-col gap-2">
              {announcements.slice(0, 3).map((a) => (
                <Link
                  key={a.id}
                  to={'/announcements' as string}
                  className="rounded-card focus-visible:outline-none focus-visible:shadow-ring"
                >
                  <Card variant="elevated" className="p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-strong">{a.title}</p>
                      <Badge tone={PRIORITY_TONE[a.priority] ?? 'neutral'} size="sm" dot>
                        {a.priority.charAt(0) + a.priority.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{a.content}</p>
                    {a.publishAt && <p className="mt-1.5 text-2xs text-subtle">{timeAgo(a.publishAt)}</p>}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title="Amenities">
          {amenities.isLoading ? (
            <Skeleton className="h-20 rounded-card" />
          ) : (amenities.data?.items ?? []).length === 0 ? (
            <EmptyState icon={Sparkles} title="No amenities listed" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(amenities.data?.items ?? []).map((a) => (
                <Badge key={a.id} tone="brand" size="md">{a.name}</Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Emergency contacts">
          {contacts.length === 0 ? (
            <SoftPlaceholder icon={PhoneCall} title="No contacts listed" note="Your community hasn’t added contacts." />
          ) : (
            <div className="flex flex-col gap-2">
              {contacts.map((c, i) => (
                <ListCard key={i}
                  onClick={() => { window.location.href = `tel:${c.phone.replace(/\s/g, '')}`; }}
                  leading={<span className="flex h-10 w-10 items-center justify-center rounded-full bg-tint text-brand"><PhoneCall className="h-5 w-5" /></span>}
                  title={c.name}
                  subtitle={[c.role, c.phone].filter(Boolean).join(' · ')} />
              ))}
            </div>
          )}
        </Section>

        <Section title="Documents">
          {documents.isLoading ? (
            <Skeleton className="h-20 rounded-card" />
          ) : (documents.data?.items ?? []).length === 0 ? (
            <EmptyState icon={FileText} title="No documents" />
          ) : (
            <div className="flex flex-col gap-2">
              {/* The whole row opens the document — a 5mm icon is not a mobile
                  tap target. Rows without a file stay inert instead of dead. */}
              {(documents.data?.items ?? []).map((d) => {
                const body = (
                  <Card variant="elevated" className="flex items-center gap-3 p-3.5">
                    <FileText className="h-5 w-5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-strong">{d.title}</p>
                      <p className="text-xs text-subtle">
                        {d.downloadUrl
                          ? d.category.replace(/_/g, ' ').toLowerCase()
                          : 'No file attached yet'}
                      </p>
                    </div>
                    {d.downloadUrl && <Download className="h-4 w-4 shrink-0 text-muted" />}
                  </Card>
                );
                return d.downloadUrl ? (
                  <a
                    key={d.id}
                    href={d.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-card focus-visible:outline-none focus-visible:shadow-ring"
                  >
                    {body}
                  </a>
                ) : (
                  <div key={d.id}>{body}</div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Residents directory — only shown to users who may read residents. */}
        <Can perm="resident:read">
          <Section title="Directory">
            <SoftPlaceholder icon={Sparkles} title="Directory available" note="Browse residents in the full portal." />
          </Section>
        </Can>
      </div>
    </div>
  );
}
