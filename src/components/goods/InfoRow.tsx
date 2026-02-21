type Props = {
    label: string;
    value: string;
};

export default function InfoRow({ label, value }: Props) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <div className="text-xs font-medium text-gray-500">{label}</div>
            <div className="text-sm font-semibold text-gray-900 text-right">{value}</div>
        </div>
    );
}