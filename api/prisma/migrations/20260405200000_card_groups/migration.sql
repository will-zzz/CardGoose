-- CreateTable
CREATE TABLE "CardGroup" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "layout_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "csv_source_url" TEXT,
    "csv_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardGroup_project_id_idx" ON "CardGroup"("project_id");

-- CreateIndex
CREATE INDEX "CardGroup_project_id_sort_order_idx" ON "CardGroup"("project_id", "sort_order");

-- AddForeignKey
ALTER TABLE "CardGroup" ADD CONSTRAINT "CardGroup_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGroup" ADD CONSTRAINT "CardGroup_layout_id_fkey" FOREIGN KEY ("layout_id") REFERENCES "Layout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
