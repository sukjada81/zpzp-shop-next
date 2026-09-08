/**
 * 본사 주문 통합검색. 주문자·수령자 외에 연락처·주소·아이디·메모·상품까지 본다.
 */

export function digitsOnly(value: string): string {
    return String(value ?? "").replace(/\D/g, "");
}

export function adminOrderKeywordInfoFilters(q: string): Array<Record<string, unknown>> {
    const text = String(q ?? "").trim();
    if (!text) return [];

    const fields = [
        "order_num",
        "id",
        "name",
        "cell",
        "email",
        "name2",
        "cell2",
        "address1",
        "address2",
        "postcode",
        "memo",
        "message",
        "checkout_shop_slug",
        "bank_info",
        "pay_info",
        "pay_number",
        "pay_method",
    ];
    const filters: Array<Record<string, unknown>> = fields.map((field) => ({
        [field]: { contains: text },
    }));

    filters.push({ order_num: { equals: text } }, { id: { equals: text } });

    const compact = text.replace(/\s+/g, "");
    if (compact && compact !== text) {
        filters.push(
            { name: { contains: compact } },
            { name2: { contains: compact } },
            { bank_info: { contains: compact } }
        );
    }

    const phone = digitsOnly(text);
    if (phone.length >= 4) {
        filters.push(
            { cell: { contains: phone } },
            { cell2: { contains: phone } },
            { postcode: { contains: phone } }
        );
    }

    return filters;
}

export function adminOrderKeywordGoodsFilters(q: string): Array<Record<string, unknown>> {
    const text = String(q ?? "").trim();
    if (!text) return [];
    const filters: Array<Record<string, unknown>> = [
        { g_name: { contains: text } },
        { g_code: { contains: text } },
        { delivery_info: { contains: text } },
        { vendor: { contains: text } },
        { option_name: { contains: text } },
    ];
    if (/^\d+$/.test(text)) {
        const n = Number(text);
        if (Number.isSafeInteger(n) && n > 0) {
            filters.push({ g_uid: n }, { uid: n });
        }
    }
    return filters;
}
