export default function PromoStrip({ text }: { text: string }) {
    return (
        <div className="mt-3 rounded-2xl border bg-white px-4 py-3 text-center text-xs text-gray-600 shadow-sm">
            {text}
        </div>
    );
}