/**
 * Domain event catalog for the Community Foundation.
 *
 * Events are emitted synchronously in-process via EventEmitter2 today. The
 * payload shapes and the `DomainEvent` union are the stable contract — moving
 * to async (outbox table + broker relay) later means changing only the
 * publisher, not any emitter or listener.
 *
 * ponytail: no outbox table yet — YAGNI until there is a real async consumer
 * or broker. When one lands: persist events in a `outbox_events` row inside the
 * same transaction as the write, and relay from there. The typed contract below
 * is what that relay will carry.
 */

export const DomainEventName = {
  CommunityCreated: 'community.created',
  CommunityUpdated: 'community.updated',
  CommunityArchived: 'community.archived',
  PhaseCreated: 'phase.created',
  BlockCreated: 'block.created',
  FloorCreated: 'floor.created',
  UnitCreated: 'unit.created',
  AmenityCreated: 'amenity.created',
  DocumentAdded: 'document.added',
  SettingsUpdated: 'settings.updated',
  ProfileUpdated: 'profile.updated',
  // Sprint 3 — People Foundation
  ResidentCreated: 'resident.created',
  ResidentAssignedToUnit: 'resident.assigned',
  VendorCreated: 'vendor.created',
  StaffCreated: 'staff.created',
  // Sprint 4 — Ticket Engine
  TicketCreated: 'ticket.created',
  TicketAssigned: 'ticket.assigned',
  TicketStatusChanged: 'ticket.status_changed',
  TicketResolved: 'ticket.resolved',
  TicketClosed: 'ticket.closed',
  TicketCommentAdded: 'ticket.comment_added',
  // Sprint 5 — Service Request Engine
  ServiceRequestCreated: 'service_request.created',
  ServiceAssigned: 'service_request.assigned',
  ServiceAccepted: 'service_request.accepted',
  ServiceScheduled: 'service_request.scheduled',
  ServiceStarted: 'service_request.started',
  ServiceCompleted: 'service_request.completed',
  ServiceCancelled: 'service_request.cancelled',
  FeedbackSubmitted: 'service_request.feedback_submitted',
  // Sprint 6 — Work Order Engine
  WorkOrderCreated: 'work_order.created',
  /// Staff proposed paid work; it is waiting on a manager.
  WorkOrderRecommended: 'work_order.recommended',
  WorkOrderApproved: 'work_order.approved',
  WorkOrderRejected: 'work_order.rejected',
  WorkOrderAssigned: 'work_order.assigned',
  WorkStarted: 'work_order.started',
  ProgressUpdated: 'work_order.progress_updated',
  WorkCompleted: 'work_order.completed',
  WorkVerified: 'work_order.verified',
  WorkClosed: 'work_order.closed',
  // Sprint 7 — Asset Foundation
  AssetCreated: 'asset.created',
  AssetUpdated: 'asset.updated',
  AssetStatusChanged: 'asset.status_changed',
  AssetMoved: 'asset.moved',
  AssetPhotoAdded: 'asset.photo_added',
  AssetDocumentAdded: 'asset.document_added',
  AssetArchived: 'asset.archived',
  // Sprint 8 — Preventive Maintenance Engine
  MaintenancePlanCreated: 'maintenance.plan_created',
  MaintenancePlanUpdated: 'maintenance.plan_updated',
  MaintenancePlanActivated: 'maintenance.plan_activated',
  MaintenancePlanPaused: 'maintenance.plan_paused',
  MaintenanceRunGenerated: 'maintenance.run_generated',
  MaintenanceRunSkipped: 'maintenance.run_skipped',
  MaintenanceWorkOrderCreated: 'maintenance.work_order_created',
  // Sprint 9 — AMC Management Engine
  AMCContractCreated: 'amc.contract_created',
  AMCContractActivated: 'amc.contract_activated',
  AMCContractRenewed: 'amc.contract_renewed',
  AMCContractExpired: 'amc.contract_expired',
  AMCAssetCovered: 'amc.asset_covered',
  AMCAssetRemoved: 'amc.asset_removed',
  AMCSLAChanged: 'amc.sla_changed',
  // Sprint 10 — Community Operations (AmenityCreated + DocumentAdded reused from Sprint 2)
  VisitorCreated: 'visitor.created',
  VisitorApproved: 'visitor.approved',
  VisitorCheckedIn: 'visitor.checked_in',
  VisitorCheckedOut: 'visitor.checked_out',
  BookingCreated: 'booking.created',
  BookingCancelled: 'booking.cancelled',
  AnnouncementPublished: 'announcement.published',
  AnnouncementExpired: 'announcement.expired',
  // Sprint 11 — Payments & Maintenance Billing
  PaymentConfigUpdated: 'payment.config_updated',
  MaintenanceChargeUpdated: 'billing.charge_updated',
  InvoiceGenerated: 'billing.invoice_generated',
  InvoiceCancelled: 'billing.invoice_cancelled',
  PaymentInitiated: 'payment.initiated',
  PaymentSucceeded: 'payment.succeeded',
  PaymentFailed: 'payment.failed',
  PaymentRefunded: 'payment.refunded',
  // Sprint 11 — WhatsApp gateway sessions
  WhatsAppSessionConnected: 'whatsapp.session_connected',
  WhatsAppSessionDisconnected: 'whatsapp.session_disconnected',
  // Sprint 13 — Gate Management. `DeliveryEntryCreated` is the specified name
  // for the delivery case; it is published in addition to the generic
  // GateEntryCreated so a listener can bind to either granularity.
  GateEntryCreated: 'gate_entry.created',
  DeliveryEntryCreated: 'gate_entry.delivery_created',
  GateEntryApproved: 'gate_entry.approved',
  GateEntryRejected: 'gate_entry.rejected',
  GateEntryCompleted: 'gate_entry.completed',
  GateEntryCancelled: 'gate_entry.cancelled',
} as const;

export type DomainEventName =
  (typeof DomainEventName)[keyof typeof DomainEventName];

/** Envelope every domain event shares. */
export interface DomainEventEnvelope<TName extends DomainEventName, TData> {
  name: TName;
  /** When the event occurred. */
  occurredAt: Date;
  /** Tenant the event belongs to (null for platform-level actors). */
  tenantId: string | null;
  /** Community the event belongs to (null only for tenant-level events). */
  communityId: string | null;
  /** Who caused it. */
  actorId: string | null;
  /** The primary entity id the event concerns. */
  entityId: string;
  data: TData;
}

export type CommunityEvent = DomainEventEnvelope<
  | typeof DomainEventName.CommunityCreated
  | typeof DomainEventName.CommunityUpdated
  | typeof DomainEventName.CommunityArchived,
  { name: string; code: string }
>;

export type HierarchyEvent = DomainEventEnvelope<
  | typeof DomainEventName.PhaseCreated
  | typeof DomainEventName.BlockCreated
  | typeof DomainEventName.FloorCreated,
  { name: string; code?: string }
>;

export type UnitEvent = DomainEventEnvelope<
  typeof DomainEventName.UnitCreated,
  { unitNumber: string }
>;

export type AmenityEvent = DomainEventEnvelope<
  typeof DomainEventName.AmenityCreated,
  { name: string }
>;

export type DocumentEvent = DomainEventEnvelope<
  typeof DomainEventName.DocumentAdded,
  { title: string; category: string }
>;

export type SettingsEvent = DomainEventEnvelope<
  typeof DomainEventName.SettingsUpdated,
  Record<string, never>
>;

export type ProfileEvent = DomainEventEnvelope<
  typeof DomainEventName.ProfileUpdated,
  { userId: string }
>;

export type ResidentEvent = DomainEventEnvelope<
  | typeof DomainEventName.ResidentCreated
  | typeof DomainEventName.ResidentAssignedToUnit,
  { residentCode: string; unitId?: string }
>;

export type VendorEvent = DomainEventEnvelope<
  typeof DomainEventName.VendorCreated,
  { name: string; category: string }
>;

export type StaffEvent = DomainEventEnvelope<
  typeof DomainEventName.StaffCreated,
  { employeeId: string; role: string }
>;

export type TicketEvent = DomainEventEnvelope<
  | typeof DomainEventName.TicketCreated
  | typeof DomainEventName.TicketAssigned
  | typeof DomainEventName.TicketStatusChanged
  | typeof DomainEventName.TicketResolved
  | typeof DomainEventName.TicketClosed
  | typeof DomainEventName.TicketCommentAdded,
  {
    ticketNumber: string;
    status?: string;
    fromStatus?: string;
    assigneeType?: 'staff' | 'vendor';
    assigneeId?: string;
    commentId?: string;
    /** True when the vendor was chosen by the auto-assignment rule. */
    auto?: boolean;
  }
>;

export type ServiceRequestEvent = DomainEventEnvelope<
  | typeof DomainEventName.ServiceRequestCreated
  | typeof DomainEventName.ServiceAssigned
  | typeof DomainEventName.ServiceAccepted
  | typeof DomainEventName.ServiceScheduled
  | typeof DomainEventName.ServiceStarted
  | typeof DomainEventName.ServiceCompleted
  | typeof DomainEventName.ServiceCancelled
  | typeof DomainEventName.FeedbackSubmitted,
  {
    requestNumber: string;
    status?: string;
    fromStatus?: string;
    assigneeType?: 'staff' | 'vendor';
    assigneeId?: string;
    rating?: number;
  }
>;

export type WorkOrderEvent = DomainEventEnvelope<
  | typeof DomainEventName.WorkOrderCreated
  | typeof DomainEventName.WorkOrderRecommended
  | typeof DomainEventName.WorkOrderApproved
  | typeof DomainEventName.WorkOrderRejected
  | typeof DomainEventName.WorkOrderAssigned
  | typeof DomainEventName.WorkStarted
  | typeof DomainEventName.ProgressUpdated
  | typeof DomainEventName.WorkCompleted
  | typeof DomainEventName.WorkVerified
  | typeof DomainEventName.WorkClosed,
  {
    workOrderNumber: string;
    status?: string;
    assigneeType?: 'staff' | 'vendor';
    assigneeId?: string;
    progressPercent?: number;
  }
>;

export type AssetEvent = DomainEventEnvelope<
  | typeof DomainEventName.AssetCreated
  | typeof DomainEventName.AssetUpdated
  | typeof DomainEventName.AssetStatusChanged
  | typeof DomainEventName.AssetMoved
  | typeof DomainEventName.AssetPhotoAdded
  | typeof DomainEventName.AssetDocumentAdded
  | typeof DomainEventName.AssetArchived,
  {
    assetCode: string;
    name?: string;
    status?: string;
    fromStatus?: string;
  }
>;

export type MaintenanceEvent = DomainEventEnvelope<
  | typeof DomainEventName.MaintenancePlanCreated
  | typeof DomainEventName.MaintenancePlanUpdated
  | typeof DomainEventName.MaintenancePlanActivated
  | typeof DomainEventName.MaintenancePlanPaused
  | typeof DomainEventName.MaintenanceRunGenerated
  | typeof DomainEventName.MaintenanceRunSkipped
  | typeof DomainEventName.MaintenanceWorkOrderCreated,
  {
    planName: string;
    assetId?: string;
    runId?: string;
    workOrderId?: string;
    reason?: string;
  }
>;

export type AMCEvent = DomainEventEnvelope<
  | typeof DomainEventName.AMCContractCreated
  | typeof DomainEventName.AMCContractActivated
  | typeof DomainEventName.AMCContractRenewed
  | typeof DomainEventName.AMCContractExpired
  | typeof DomainEventName.AMCAssetCovered
  | typeof DomainEventName.AMCAssetRemoved
  | typeof DomainEventName.AMCSLAChanged,
  {
    contractNumber: string;
    vendorId?: string;
    assetId?: string;
    status?: string;
    fromStatus?: string;
    priority?: string;
  }
>;

export type VisitorEvent = DomainEventEnvelope<
  | typeof DomainEventName.VisitorCreated
  | typeof DomainEventName.VisitorApproved
  | typeof DomainEventName.VisitorCheckedIn
  | typeof DomainEventName.VisitorCheckedOut,
  { visitorName: string; residentId: string; status?: string; passCode?: string }
>;

export type BookingEvent = DomainEventEnvelope<
  | typeof DomainEventName.BookingCreated
  | typeof DomainEventName.BookingCancelled,
  { amenityId: string; residentId: string; status?: string }
>;

export type AnnouncementEvent = DomainEventEnvelope<
  | typeof DomainEventName.AnnouncementPublished
  | typeof DomainEventName.AnnouncementExpired,
  { title: string; priority?: string }
>;

export type BillingEvent = DomainEventEnvelope<
  | typeof DomainEventName.PaymentConfigUpdated
  | typeof DomainEventName.MaintenanceChargeUpdated
  | typeof DomainEventName.InvoiceGenerated
  | typeof DomainEventName.InvoiceCancelled,
  { purpose?: string; propertyType?: string; invoiceNumber?: string; count?: number; amount?: number }
>;

export type PaymentEvent = DomainEventEnvelope<
  | typeof DomainEventName.PaymentInitiated
  | typeof DomainEventName.PaymentSucceeded
  | typeof DomainEventName.PaymentFailed
  | typeof DomainEventName.PaymentRefunded,
  {
    purpose: string;
    amount: number;
    invoiceId?: string | null;
    serviceRequestId?: string | null;
    gatewayOrderId?: string | null;
    gatewayPaymentId?: string | null;
    reason?: string;
  }
>;

export type WhatsAppSessionEvent = DomainEventEnvelope<
  | typeof DomainEventName.WhatsAppSessionConnected
  | typeof DomainEventName.WhatsAppSessionDisconnected,
  { session: string; phoneNumber?: string | null; reason?: string }
>;

export type GateEntryEvent = DomainEventEnvelope<
  | typeof DomainEventName.GateEntryCreated
  | typeof DomainEventName.DeliveryEntryCreated
  | typeof DomainEventName.GateEntryApproved
  | typeof DomainEventName.GateEntryRejected
  | typeof DomainEventName.GateEntryCompleted
  | typeof DomainEventName.GateEntryCancelled,
  {
    entryNumber: string;
    entryType: string;
    status: string;
    unitId: string;
    residentId?: string | null;
    personName: string;
    vendorName?: string | null;
    decisionNote?: string | null;
  }
>;

export type DomainEvent =
  | CommunityEvent
  | HierarchyEvent
  | UnitEvent
  | AmenityEvent
  | DocumentEvent
  | SettingsEvent
  | ProfileEvent
  | ResidentEvent
  | VendorEvent
  | StaffEvent
  | TicketEvent
  | ServiceRequestEvent
  | WorkOrderEvent
  | AssetEvent
  | MaintenanceEvent
  | AMCEvent
  | VisitorEvent
  | BookingEvent
  | AnnouncementEvent
  | BillingEvent
  | PaymentEvent
  | WhatsAppSessionEvent
  | GateEntryEvent;
