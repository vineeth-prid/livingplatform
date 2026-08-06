-- Before/after site evidence on tickets and work orders.
--
-- Additive and nullable: every existing attachment stays an ordinary
-- attachment (stage NULL), which is what an invoice or spec sheet should be.
CREATE TYPE "WorkEvidenceStage" AS ENUM ('BEFORE', 'AFTER');

ALTER TABLE "work_order_attachments" ADD COLUMN "stage" "WorkEvidenceStage";
ALTER TABLE "ticket_attachments" ADD COLUMN "stage" "WorkEvidenceStage";

CREATE INDEX "work_order_attachments_workOrderId_stage_idx"
  ON "work_order_attachments"("workOrderId", "stage");
CREATE INDEX "ticket_attachments_ticketId_stage_idx"
  ON "ticket_attachments"("ticketId", "stage");
