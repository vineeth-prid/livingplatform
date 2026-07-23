import type { AuditFields, ID, ISODate } from './common';
import type {
  AMCEventType, AMCStatus, AnnouncementPriority, AnnouncementStatus,
  AssetCondition, AssetCriticality, AssetEventType, AssetStatus,
  BlockType, BookingStatus, CommunityStatus, CommunityType, CoverageType,
  DocumentCategory, DocumentStatus,
  Gender, HierarchyStatus, MaintenanceFrequency, MaintenanceRunStatus,
  OwnershipType, PaymentFrequency, PersonStatus, ResidentRole,
  ResidentStatus, ServiceRequestStatus, StaffRole, TicketPriority, TicketSource,
  TicketStatus, UnitStatus, VendorCategory, VisitorStatus, VisitorType,
  WorkOrderOriginType, WorkOrderStatus,
} from './enums';

// ── Community Foundation ─────────────────────────────────────────────────────

export interface Community extends AuditFields {
  id: ID;
  tenantId: ID;
  name: string;
  slug: string;
  code: string;
  description?: string | null;
  type: CommunityType;
  status: CommunityStatus;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  timezone: string;
  logoKey?: string | null;
  logoUrl?: string | null;
  coverImageKey?: string | null;
  coverImageUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  builderName?: string | null;
  associationName?: string | null;
  registrationNumber?: string | null;
  goLiveDate?: ISODate | null;
  /** Array of { name, role?, phone } objects. */
  emergencyContacts?: unknown;
  statistics?: {
    phases: number; blocks: number; units: number; amenities: number; documents: number;
  };
}

export interface Phase extends AuditFields {
  id: ID; communityId: ID; name: string; code: string; sortOrder: number; status: HierarchyStatus;
}
export interface Block extends AuditFields {
  id: ID; communityId: ID; phaseId?: ID | null; name: string; code: string;
  type: BlockType; totalFloors?: number | null; sortOrder: number; status: HierarchyStatus;
}
export interface Floor extends AuditFields {
  id: ID; communityId: ID; blockId: ID; level: number; name?: string | null; status: HierarchyStatus;
}
export interface Unit extends AuditFields {
  id: ID; communityId: ID; phaseId?: ID | null; blockId?: ID | null; floorId?: ID | null;
  unitNumber: string; type?: string | null; bedrooms?: number | null; bathrooms?: number | null;
  builtUpArea?: number | null; areaUnit: string; parkingSlots: number;
  status: UnitStatus; ownership: OwnershipType;
  ownerName?: string | null; ownerPhone?: string | null;
}
export interface Amenity extends AuditFields {
  id: ID; communityId: ID; name: string; code?: string | null; category?: string | null;
  description?: string | null; capacity?: number | null; location?: string | null; isBookable: boolean;
  operatingHours?: unknown; imageKey?: string | null; imageUrl?: string | null;
  sortOrder: number; status: HierarchyStatus;
  /** Booking configuration (Sprint 10) — read by the Amenity Booking engine. */
  bookingWindowDays?: number; slotDurationMinutes?: number;
}
export interface CommunityDocument extends AuditFields {
  id: ID; communityId: ID; title: string; description?: string | null;
  category: DocumentCategory; status: DocumentStatus; fileName?: string | null;
  downloadUrl?: string | null; tags: string[]; version?: string | null;
  issuedOn?: ISODate | null; expiresOn?: ISODate | null;
}

// ── People Foundation ────────────────────────────────────────────────────────

export interface ResidentUnitLink {
  id: ID; unitId: ID; role: ResidentRole; status: ResidentStatus;
  moveInDate?: ISODate | null; moveOutDate?: ISODate | null;
  unit?: Pick<Unit, 'id' | 'unitNumber' | 'blockId' | 'floorId'>;
}
export interface Resident extends AuditFields {
  id: ID; communityId: ID; userId?: ID | null; residentCode: string;
  firstName: string; lastName: string; mobile: string; email?: string | null;
  photoKey?: string | null; photoUrl?: string | null; gender?: Gender | null;
  dateOfBirth?: ISODate | null;
  occupation?: string | null; moveInDate?: ISODate | null; status: ResidentStatus;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  notes?: string | null; unitAssignment?: ResidentUnitLink | null;
}
export interface Vendor extends AuditFields {
  id: ID; tenantId: ID; userId?: ID | null; code?: string | null; name: string;
  companyName?: string | null; category: VendorCategory; serviceCategories: VendorCategory[];
  phone: string; email?: string | null; addressLine?: string | null; city?: string | null;
  communityIds: ID[]; status: PersonStatus; remarks?: string | null;
}
export interface Staff extends AuditFields {
  id: ID; communityId: ID; userId?: ID | null; employeeId: string;
  firstName: string; lastName: string; role: StaffRole; department?: string | null;
  phone: string; email?: string | null; photoKey?: string | null; photoUrl?: string | null;
  status: PersonStatus;
}

/** Resolved assignee attached to ticket / service-request / work-order details. */
export type Assignee =
  | { type: 'staff'; id: ID; firstName: string; lastName: string; role: StaffRole }
  | { type: 'vendor'; id: ID; name: string; category: VendorCategory };

// ── Ticket Engine ────────────────────────────────────────────────────────────

export interface TicketCategory {
  id: ID; tenantId: ID | null; key: string; name: string;
  color?: string | null; iconKey?: string | null; isActive: boolean; isSystem: boolean; sortOrder: number;
}
export interface Ticket extends AuditFields {
  id: ID; number: number; ticketNumber: string; communityId: ID; unitId: ID;
  categoryId: ID; residentId?: ID | null; title: string; description: string;
  priority: TicketPriority; status: TicketStatus; source: TicketSource;
  reportedById: ID; assignedStaffId?: ID | null; assignedVendorId?: ID | null;
  reassignedCount: number; dueDate?: ISODate | null; resolvedDate?: ISODate | null; closedDate?: ISODate | null;
  category?: Pick<TicketCategory, 'id' | 'key' | 'name' | 'color'>;
  unit?: Pick<Unit, 'id' | 'unitNumber' | 'blockId' | 'floorId'>;
  resident?: Pick<Resident, 'id' | 'firstName' | 'lastName'>;
  assignee?: Assignee | null;
}
export interface TicketComment {
  id: ID; ticketId: ID; authorId: ID; body: string; isInternal: boolean; createdAt: ISODate;
}
export interface TicketAttachment {
  id: ID; ticketId: ID; fileName: string; contentType: string; size: number;
  storageKey: string; downloadUrl?: string | null; uploadedById: ID; createdAt: ISODate;
}
export interface TimelineEvent {
  id: ID; type: string; actorId?: ID | null; reference?: string | null;
  metadata?: Record<string, unknown> | null; createdAt: ISODate;
}

// ── Service Request Engine ───────────────────────────────────────────────────

export interface Service {
  id: ID; tenantId: ID | null; key: string; name: string; description?: string | null;
  estimatedDurationMinutes?: number | null; iconKey?: string | null; color?: string | null;
  isActive: boolean; isSystem: boolean; sortOrder: number;
}
export interface ServiceRequest extends AuditFields {
  id: ID; number: number; requestNumber: string; communityId: ID; unitId: ID; serviceId: ID;
  residentId?: ID | null; title: string; description: string; priority: TicketPriority;
  status: ServiceRequestStatus; requestedById: ID; assignedStaffId?: ID | null; assignedVendorId?: ID | null;
  preferredDate?: ISODate | null; preferredTimeSlot?: string | null;
  actualStart?: ISODate | null; actualEnd?: ISODate | null; completedDate?: ISODate | null;
  ticketId?: ID | null; service?: Pick<Service, 'id' | 'key' | 'name' | 'color'>;
  unit?: Pick<Unit, 'id' | 'unitNumber'>; assignee?: Assignee | null;
}
export interface ServiceFeedback {
  id: ID; serviceRequestId: ID; rating: number; comment?: string | null; createdById: ID; createdAt: ISODate;
}

// ── Work Order Engine ────────────────────────────────────────────────────────

export interface WorkOrder extends AuditFields {
  id: ID; number: number; workOrderNumber: string; communityId: ID; unitId?: ID | null;
  title: string; description: string; priority: TicketPriority; status: WorkOrderStatus;
  assignedStaffId?: ID | null; assignedVendorId?: ID | null; reassignedCount: number;
  originType: WorkOrderOriginType; originId?: ID | null;
  requestedById?: ID | null; requestedDate?: ISODate | null;
  recommendedById?: ID | null; approvedById?: ID | null; approvedDate?: ISODate | null;
  rejectionReason?: string | null;
  estimatedLabourCost?: string | null; estimatedMaterialCost?: string | null; estimatedTotalCost?: string | null;
  estimatedHours?: number | null; actualHours?: number | null;
  dueDate?: ISODate | null; startedDate?: ISODate | null; completedDate?: ISODate | null;
  verifiedDate?: ISODate | null; verificationRemarks?: string | null;
  unit?: Pick<Unit, 'id' | 'unitNumber'>; assignee?: Assignee | null;
}
export interface WorkOrderUpdate {
  id: ID; workOrderId: ID; authorId: ID; comment: string;
  progressPercent?: number | null; isInternal: boolean; createdAt: ISODate;
}
export interface WorkOrderAttachment {
  id: ID; workOrderId: ID; fileName: string; contentType: string; size: number;
  storageKey: string; downloadUrl?: string | null; uploadedById: ID; createdAt: ISODate;
}

/** Response of the ticket dashboard summary endpoint. */
export interface TicketDashboardSummary {
  open: number; assigned: number; inProgress: number; onHold: number;
  resolvedToday: number; closedToday: number; criticalOpen: number;
  byStatus: { status: TicketStatus; count: number }[];
  byPriority: { priority: TicketPriority; count: number }[];
  byCategory: { categoryId: ID; name: string | null; color: string | null; count: number }[];
}

// ── Asset Foundation ─────────────────────────────────────────────────────────

export interface AssetCategory extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; parentCategoryId?: ID | null;
  name: string; code: string; icon?: string | null; color?: string | null;
  description?: string | null; sortOrder: number; isActive: boolean;
  childCategories?: AssetCategory[];
  _count?: { assets: number; childCategories?: number };
}

export interface Asset extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; categoryId: ID;
  assetCode: string; name: string; description?: string | null;
  manufacturer?: string | null; model?: string | null; serialNumber?: string | null;
  barcode?: string | null; qrCode?: string | null;
  locationDescription?: string | null;
  blockId?: ID | null; floorId?: ID | null; unitId?: ID | null;
  purchaseDate?: ISODate | null; installationDate?: ISODate | null;
  warrantyExpiry?: ISODate | null; expectedLifeMonths?: number | null;
  status: AssetStatus; criticality: AssetCriticality; condition: AssetCondition;
  metadata?: unknown;
  category?: Pick<AssetCategory, 'id' | 'name' | 'code' | 'color' | 'icon'>;
  block?: { id: ID; name: string; code: string } | null;
  floor?: { id: ID; name?: string | null; level: number } | null;
  unit?: Pick<Unit, 'id' | 'unitNumber'> | null;
  documents?: AssetDocument[]; photos?: AssetPhoto[]; events?: AssetEvent[];
}

export interface AssetDocument {
  id: ID; assetId: ID; storageKey: string; fileName: string;
  mimeType?: string | null; uploadedById: ID; downloadUrl?: string | null; createdAt: ISODate;
}

export interface AssetPhoto {
  id: ID; assetId: ID; storageKey: string; caption?: string | null;
  uploadedById: ID; url?: string | null; createdAt: ISODate;
}

/** Immutable asset history entry. */
export interface AssetEvent {
  id: ID; assetId: ID; eventType: AssetEventType; description?: string | null;
  performedById?: ID | null; metadata?: Record<string, unknown> | null; createdAt: ISODate;
}

// ── Preventive Maintenance ───────────────────────────────────────────────────

export interface MaintenanceChecklistTemplate {
  id: ID; planId: ID; title: string; sortOrder: number;
  isMandatory: boolean; instructions?: string | null; createdAt: ISODate;
}

export interface MaintenanceRun {
  id: ID; planId: ID; scheduledAt: ISODate; executedAt?: ISODate | null;
  generatedWorkOrderId?: ID | null; status: MaintenanceRunStatus;
  generationReason?: string | null; notes?: string | null; createdAt: ISODate;
}

export interface MaintenancePlan extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; assetId: ID;
  name: string; description?: string | null;
  frequencyType: MaintenanceFrequency; frequencyInterval: number;
  cronExpression?: string | null;
  startDate: ISODate; endDate?: ISODate | null;
  nextRunAt: ISODate; lastRunAt?: ISODate | null;
  priority: TicketPriority; estimatedDurationMinutes?: number | null;
  requiresVerification: boolean; isActive: boolean;
  asset?: Pick<Asset, 'id' | 'assetCode' | 'name' | 'status' | 'criticality'> & {
    category?: { id: ID; name: string; code: string; color?: string | null };
  };
  checklistTemplates?: MaintenanceChecklistTemplate[];
  runs?: MaintenanceRun[];
  _count?: { runs: number; checklistTemplates?: number };
}

// ── AMC Management ───────────────────────────────────────────────────────────

export interface AMCCoverage {
  id: ID; contractId: ID; assetId: ID; coverageType: CoverageType;
  responseTimeHours?: number | null; resolutionTimeHours?: number | null;
  visitFrequency?: string | null; priority: TicketPriority; remarks?: string | null;
  createdAt: ISODate;
  asset?: Pick<Asset, 'id' | 'assetCode' | 'name' | 'status' | 'criticality'>;
}

export interface AMCSLARule {
  id: ID; contractId: ID; priority: TicketPriority;
  responseTimeMinutes: number; resolutionTimeMinutes: number;
  escalationAfterMinutes?: number | null; createdAt: ISODate; updatedAt: ISODate;
}

export interface AMCHistory {
  id: ID; contractId: ID; eventType: AMCEventType; description?: string | null;
  performedById?: ID | null; metadata?: Record<string, unknown> | null; createdAt: ISODate;
}

export interface AMCContract extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; vendorId: ID;
  contractNumber: string; name: string; description?: string | null;
  status: AMCStatus; startDate: ISODate; endDate: ISODate; renewalReminderDays: number;
  /** Serialized decimal (2-dp) — parse before arithmetic. */
  annualCost: string; currency: string; paymentFrequency: PaymentFrequency;
  contactPerson?: string | null; contactPhone?: string | null; contactEmail?: string | null;
  notes?: string | null; autoRenew: boolean;
  vendor?: Pick<Vendor, 'id' | 'name' | 'category' | 'companyName'>;
  coverages?: AMCCoverage[]; slaRules?: AMCSLARule[]; history?: AMCHistory[];
  _count?: { coverages: number; slaRules?: number };
}

// ── Community Operations ─────────────────────────────────────────────────────

export interface Visitor extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; residentId: ID;
  visitorName: string; mobileNumber: string; vehicleNumber?: string | null;
  visitorType: VisitorType; purpose?: string | null;
  expectedArrival: ISODate; actualCheckIn?: ISODate | null; actualCheckOut?: ISODate | null;
  status: VisitorStatus; passCode: string; notes?: string | null; approvedById?: ID | null;
  resident?: Pick<Resident, 'id' | 'firstName' | 'lastName'>;
}

export interface AmenityBooking extends AuditFields {
  id: ID; tenantId: ID; communityId: ID; amenityId: ID; residentId: ID;
  bookingDate: ISODate; startTime: ISODate; endTime: ISODate;
  status: BookingStatus; remarks?: string | null;
  amenity?: Pick<Amenity, 'id' | 'name' | 'location'>;
  resident?: Pick<Resident, 'id' | 'firstName' | 'lastName'>;
}

export interface Announcement extends AuditFields {
  id: ID; tenantId: ID; communityId: ID;
  title: string; content: string; priority: AnnouncementPriority;
  publishAt?: ISODate | null; expiresAt?: ISODate | null; status: AnnouncementStatus;
}

/** Result of an in-community search. */
export interface CommunitySearchResult {
  query: string;
  results: {
    units: Pick<Unit, 'id' | 'unitNumber' | 'status'>[];
    blocks: Pick<Block, 'id' | 'name' | 'code' | 'type'>[];
    amenities: Pick<Amenity, 'id' | 'name' | 'category'>[];
    documents: Pick<CommunityDocument, 'id' | 'title' | 'category'>[];
  };
  counts: { units: number; blocks: number; amenities: number; documents: number };
}
