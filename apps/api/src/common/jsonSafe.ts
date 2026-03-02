// apps/api/src/common/jsonSafe.ts

/**
 * JSON stringify 시 BigInt 때문에 터지는 문제 해결용
 * - BigInt -> string 변환
 * - 나머지는 그대로
 */
export function jsonSafe<T>(value: T): any {
    return JSON.parse(
        JSON.stringify(value, (_k, v) => {
            if (typeof v === "bigint") return v.toString();
            return v;
        })
    );
}