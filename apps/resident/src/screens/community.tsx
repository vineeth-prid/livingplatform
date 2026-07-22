import { useQueries } from '@tanstack/react-query';
import { Download, FileText, Megaphone, PhoneCall, Sparkles } from 'lucide-react';
import { Can } from '@living/hooks';
import { Badge, Card, EmptyState, Skeleton } from '@living/ui';

import { useResidentCommunity } from '../community';
import { living } from '../lib/living';
import { ListCard, Section, SoftPlaceholder } from '../components';
import { ScreenHeader } from '../shell';

interface EmergencyContact { name: string; role?: string; phone: string }

export function CommunityScreen() {
  const { community, communityId } = useResidentCommunity();

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
        <Section title="Announcements">
          <SoftPlaceholder icon={Megaphone} title="Nothing new" note="Notices from your association appear here." />
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
              {(documents.data?.items ?? []).map((d) => (
                <Card key={d.id} variant="elevated" className="flex items-center gap-3 p-3.5">
                  <FileText className="h-5 w-5 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-strong">{d.title}</p>
                    <p className="text-xs text-subtle">{d.category.replace(/_/g, ' ').toLowerCase()}</p>
                  </div>
                  {d.downloadUrl && (
                    <a href={d.downloadUrl} target="_blank" rel="noreferrer" aria-label="Open" className="rounded-md p-1.5 text-muted hover:text-brand">
                      <Download className="h-4 w-4" />
                    </a>
                  )}
                </Card>
              ))}
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
