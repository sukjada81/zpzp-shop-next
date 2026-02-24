import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // tenants upsert
    const a = await prisma.tenant.upsert({
        where: { slug: "a" },
        update: { name: "A 지점", primaryDomain: "a.example.com", status: "active" },
        create: { slug: "a", name: "A 지점", primaryDomain: "a.example.com", status: "active" },
    });

    const b = await prisma.tenant.upsert({
        where: { slug: "b" },
        update: { name: "B 지점", primaryDomain: "b.example.com", status: "active" },
        create: { slug: "b", name: "B 지점", primaryDomain: "b.example.com", status: "active" },
    });

    // super admin upsert
    const admin = await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: { name: "Super Admin", isSuperAdmin: true, status: "active" },
        create: {
            email: "admin@example.com",
            name: "Super Admin",
            passwordHash: "TEMP_HASH",
            isSuperAdmin: true,
            status: "active",
        },
    });

    // memberships (compound unique key name is tenantId_userId)
    await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: a.id, userId: admin.id } },
        update: { role: "TENANT_ADMIN" },
        create: { tenantId: a.id, userId: admin.id, role: "TENANT_ADMIN" },
    });

    await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: b.id, userId: admin.id } },
        update: { role: "TENANT_ADMIN" },
        create: { tenantId: b.id, userId: admin.id, role: "TENANT_ADMIN" },
    });

    console.log("✅ seed done", {
        tenantA: a.id.toString(),
        tenantB: b.id.toString(),
        admin: admin.id.toString(),
    });
}

main()
    .catch((e) => {
        console.error("seed error:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });