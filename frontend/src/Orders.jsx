import { useEffect, useState } from "react";
import { api } from "./api";
import { STATUS_LABEL, STEPS } from "./status.js";
import MapView from "./MapView";

export function OrderList({ onOpen }) {
    const [orders, setOrders] = useState(null);
    useEffect(() => {
        api.get("/orders").then(setOrders).catch(() => setOrders([]));
    }, []);
    if (!orders) return <p className="muted">Loading...</p>;
    if (!orders.length) return <p className="muted">No orders yet.</p>;
    return (
        <div>
            {orders.map((o) => (
                <div className="card order" key={o.id} onClick={() => onOpen(o.id)}>
                    <div>
                        <b>Order #{o.id}</b>
                        <div className="muted">{o.items.map((i) => `${i.name} x${i.qty}`).join(", ")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <b>₹{o.total}</b>
                        <div className={"badge " + o.status}>{STATUS_LABEL[o.status]}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function Track({ id }) {
    const [o, setO] = useState(null);
    const [err, setErr] = useState("");

    useEffect(() => {
        let alive = true;
        const load = () =>
            api.get(`/orders/${id}`).then((d) => alive && setO(d)).catch((e) => alive && setErr(e.message));
        load();
        const t = setInterval(load, 4000);
        return () => {
            alive = false;
            clearInterval(t);
        };
    }, [id]);

    if (err) return <div className="error">{err}</div>;
    if (!o) return <p className="muted">Loading...</p>;
    const idx = STEPS.indexOf(o.status);

    return (
        <div className="two-col">
            <div className="card">
                <h3>Order #{o.id}</h3>
                <div className={"badge big " + o.status}>{STATUS_LABEL[o.status]}</div>
                {o.status === "rejected" ? (
                    <p className="error">The shop could not accept this order. Your refund is pending.</p>
                ) : (
                    <ol className="steps">
                        {STEPS.map((s, i) => (
                            <li key={s} className={i <= idx ? "done" : ""}>{STATUS_LABEL[s]}</li>
                        ))}
                    </ol>
                )}
                <hr />
                {o.items.map((i, k) => (
                    <div className="line" key={k}><span>{i.name} x{i.qty}</span><b>₹{i.price * i.qty}</b></div>
                ))}
                <div className="line total"><span>Total paid</span><b>₹{o.total}</b></div>
                {o.address && <p className="muted">Deliver to: {o.address}</p>}
            </div>
            <div className="card">
                <h3>Live tracking</h3>
                <p className="muted">🏪 Shop &nbsp; 📍 You &nbsp; 🛵 Rider (updates every 4 seconds)</p>
                <MapView shop={o.shop} dest={{ lat: o.lat, lng: o.lng }} rider={o.rider} height={340} />
            </div>
        </div>
    );
}