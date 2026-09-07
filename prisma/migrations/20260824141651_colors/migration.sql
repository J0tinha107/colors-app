-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "shopifyMetaobjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "swatchColor" TEXT,
    "patternFileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "colors_shopifyMetaobjectId_key" ON "colors"("shopifyMetaobjectId");

-- CreateIndex
CREATE INDEX "colors_shopDomain_idx" ON "colors"("shopDomain");
