type Props = { params: { id: string } };

export default function SellerOrderDetailPage({ params }: Props) {
    return (
        <div className="p-4">
            <h2 className="text-base font-extrabold">주문 상세</h2>
            <p className="mt-2 text-sm text-gray-600">주문 ID: {params.id}</p>
        </div>
    );
}