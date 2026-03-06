import type { FastifyInstance } from "fastify";
import fs from "fs";
import path from "path";
import crypto from "crypto";

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function createFilename(original: string) {
    const ext = path.extname(original) || ".jpg";
    const random = crypto.randomBytes(4).toString("hex");
    return `${Date.now()}_${random}${ext}`;
}

export async function adminUploadsRoutes(app: FastifyInstance) {
    app.post("/admin/uploads/product-image", async (req, reply) => {

        const data = await req.file();

        if (!data) {
            reply.code(400);
            return { ok: false, message: "file required" };
        }

        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");

        const uploadDir = path.join(
            process.cwd(),
            "uploads",
            "products",
            String(yyyy),
            mm
        );

        ensureDir(uploadDir);

        const filename = createFilename(data.filename);

        const filepath = path.join(uploadDir, filename);

        const buffer = await data.toBuffer();

        fs.writeFileSync(filepath, buffer);

        const relative = `uploads/products/${yyyy}/${mm}/${filename}`;

        return {
            ok: true,
            path: relative,
            url: `/${relative}`
        };
    });
}