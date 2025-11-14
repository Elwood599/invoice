-- CreateTable
-- CREATE TABLE "Session" (
--     "id" TEXT NOT NULL PRIMARY KEY,
--     "shop" TEXT NOT NULL,
--     "state" TEXT NOT NULL,
--     "isOnline" BOOLEAN NOT NULL DEFAULT false,
--     "scope" TEXT,
--     "expires" DATETIME,
--     "accessToken" TEXT NOT NULL,
--     "userId" BIGINT,
--     "firstName" TEXT,
--     "lastName" TEXT,
--     "email" TEXT,
--     "accountOwner" BOOLEAN NOT NULL DEFAULT false,
--     "locale" TEXT,
--     "collaborator" BOOLEAN DEFAULT false,
--     "emailVerified" BOOLEAN DEFAULT false
-- );

CREATE TABLE "Session" (
     "id" TEXT NOT NULL,
     "shop" TEXT NOT NULL,
     "state" TEXT NOT NULL,
     "isOnline" BOOLEAN NOT NULL DEFAULT false,
     "scope" TEXT,
     "expires" TIMESTAMP WITHOUT TIME ZONE,
     "accessToken" TEXT NOT NULL,
     "userId" BIGINT,
     "firstName" TEXT,
     "lastName" TEXT,
     "email" TEXT,
     "accountOwner" BOOLEAN NOT NULL DEFAULT false,
     "locale" TEXT,
     "collaborator" BOOLEAN DEFAULT false,
     "emailVerified" BOOLEAN DEFAULT false,

     CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
 );
