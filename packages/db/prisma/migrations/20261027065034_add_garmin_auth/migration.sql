-- CreateTable
CREATE TABLE "GarminAuth" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "oauth1" JSONB NOT NULL,
    "oauth2" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GarminAuth_pkey" PRIMARY KEY ("id")
);
