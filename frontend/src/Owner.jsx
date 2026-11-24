import { useEffect, useState } from "react";
import { api } from "./api";
import { STATUS_LABEL } from "./status";

const NEXT = {
    placed: [["accepted", "Accept"], ["rejected", "Reject"]],
    accepted: [["packing", "Start packing"]],
    packing: [["out_for_delivery", "Out for delivery"]],
    out_for_delivery: [["delivered", "Mark delivered"]],
};

export default function Owner() {
    const [orders, setOrders] = useState([]);
    const [err, setErr] = useState("");

    const load = () => api.get("/owner/orders").then(setOrders).catch((e) => setErr(e.message));
    useEffect(() => {
        load();
        const t = setInterval(load, 5000);
        return () => clearInterval(t);
    }, []);

    async function move(id, status) {
        try {
            await api.post(`/owner/orders/${id}/status`, { status });
            load();
        } catch (e) {
            setErr(e.message);
        }
    }

    return (
        <div>
            <h2>Shop orders</h2>
            {err && <div className="error">{err}</div>}
            {orders.length === 0 && <p className="muted">No orders yet.</p>}
            {orders.map((o) => (
                <div className="card order col" key={o.id}>
                    <div className="row">
                        <b>Order #{o.id} · ₹{o.total}</b>
                        <span className={"badge " + o.status}>{STATUS_LABEL[o.status]}</span>
                    </div>
                    <div className="muted">{o.customer} {o.address && `· ${o.address}`}</div>
                    <div>{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
                    {o.payment_status === "refund_pending" && <div className="error">Refund pending</div>}
                    <div className="row">
                        {(NEXT[o.status] || []).map(([s, label]) => (
                            <button key={s} className={"btn small" + (s === "rejected" ? " danger" : "")} onClick={() => move(o.id, s)}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}