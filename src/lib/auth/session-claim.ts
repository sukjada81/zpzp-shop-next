import crypto from "crypto";

type ClaimPayload = {
    sid: string;
    next: string;
    exp: number;
};

function b64url(input: Buffer | string) {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function fromB64url(input: string) {
    const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
    return Buffer.from(b64, "base64");
}

function claimSecret() {
    return (
        process.env.AUTH_STATE_SECRET ||
        process.env.SESSION_SECRET ||
        ""
    );
}

export function signSessionClaim(payload: Omit<ClaimPayload, "exp">, ttlSec = 90) {
    const secret = claimSecret();
    if (!secret) throw new Error("Missing AUTH_STATE_SECRET/SESSION_SECRET");

    const body: ClaimPayload = {
        sid: String(payload.sid || "").trim(),
        next: String(payload.next || "").trim(),
        exp: Math.floor(Date.now() / 1000) + ttlSec,
    };
    if (!body.sid || !body.next) throw new Error("Invalid claim payload");

    const payloadB64 = b64url(JSON.stringify(body));
    const sig = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
    return `${payloadB64}.${sig}`;
}

export function verifySessionClaim(ticket: string): { ok: true; payload: ClaimPayload } | { ok: false; error: string } {
    const secret = claimSecret();
    if (!secret) return { ok: false, error: "MISSING_SECRET" };

    const raw = String(ticket || "").trim();
    const [payloadB64, sig] = raw.split(".");
    if (!payloadB64 || !sig) return { ok: false, error: "MALFORMED" };

    const expected = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, error: "BAD_SIGNATURE" };
    }

    try {
        const payload = JSON.parse(fromB64url(payloadB64).toString("utf8")) as ClaimPayload;
        if (!payload?.sid || !payload?.next || !payload?.exp) {
            return { ok: false, error: "INVALID_PAYLOAD" };
        }
        if (payload.exp < Math.floor(Date.now() / 1000)) {
            return { ok: false, error: "EXPIRED" };
        }
        return { ok: true, payload };
    } catch {
        return { ok: false, error: "PARSE_FAILED" };
    }
}
