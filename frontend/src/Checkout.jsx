import { useState } from "react";
import { api } from "./api";
import MapView from "./MapView";

function loadRazorpay() {
    return new Promise((resolve, reject) => {
        if (window.Razorpay) return resolve();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("Could not load Razorpay"));
        document.body.appendChild(s);
    });
}

export default function Checkout({ products, cart, setQty, clearCart, config, onDone }) {
    const [pos, setPos] = useState(null);
    const [address, setAddress] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const lines = products.filter((p) => cart[p.id]).map((p) => ({ ...p, qty: cart[p.id] }));
    const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const fee = subtotal >= 500 || subtotal === 0 ? 0 : 30;

    if (lines.length === 0) return <p className="muted">Your cart is empty. Add something from the shop.</p>;

    function useMyLocation() {
        if (!navigator.geolocation) return setErr("Location is not supported in this browser");
        navigator.geolocation.getCurrentPosition(
            (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => setErr("Could not get your location. Tap on the map instead.")
        );
    }

    async function placeOrder() {
        if (!pos) return setErr("Tap on the map to choose your delivery spot");
        setErr("");
        setBusy(true);
        try {
            const o = await api.post("/orders", {
                items: lines.map((l) => ({ product_id: l.id, qty: l.qty })),
                lat: pos.lat,
                lng: pos.lng,
                address,
            });
            if (!o.razorpay_order_id) {
                await api.post(`/orders/${o.id}/pay`, {}); // mock payment
                clearCart();
                return onDone(o.id);
            }
            await loadRazorpay();
            const rzp = new window.Razorpay({
                key: o.key_id,
                amount: o.total * 100,
                currency: "INR",
                name: "Haat",
                order_id: o.razorpay_order_id,
                handler: async (r) => {
                    try {
                        await api.post(`/orders/${o.id}/pay`, r);
                        clearCart();
                        onDone(o.id);
                    } catch (e) {
                        setErr(e.message);
                        setBusy(false);
                    }
                },
                modal: { ondismiss: () => setBusy(false) },
            });
            rzp.open();
        } catch (e) {
            setErr(e.message);
            setBusy(false);
        }
    }

    return (
        <div className="two-col">
            <div className="card">
                <h3>Your cart</h3>
                {lines.map((l) => (
                    <div className="line" key={l.id}>
                        <span>{l.emoji} {l.name} <span className="muted">({l.unit})</span></span>
                        <span className="qty">
                            <button onClick={() => setQty(l.id, l.qty - 1)}>−</button>
                            <span>{l.qty}</span>
                            <button onClick={() => setQty(l.id, Math.min(l.qty + 1, 20))}>+</button>
                        </span>
                        <b>₹{l.price * l.qty}</b>
                    </div>
                ))}
                <hr />
                <div className="line"><span>Subtotal</span><b>₹{subtotal}</b></div>
                <div className="line"><span>Delivery {fee === 0 && "(free over ₹500)"}</span><b>₹{fee}</b></div>
                <div className="line total"><span>Total</span><b>₹{subtotal + fee}</b></div>
                <p className="muted">Final price is calculated again on the server.</p>
            </div>

            <div className="card">
                <h3>Delivery location</h3>
                <button className="btn small ghost" onClick={useMyLocation}>📍 Use my location</button>
                <p className="muted">{pos ? "Pin set. Tap the map to move it." : "Tap on the map to drop a pin."}</p>
                <MapView shop={config.shop} dest={pos} onPick={(lat, lng) => setPos({ lat, lng })} height={260} />
                <input
                    placeholder="House no, landmark, floor..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    style={{ marginTop: 10 }}
                />
                <button className="btn" disabled={busy} onClick={placeOrder}>
                    {busy ? "Processing..." : `Pay ₹${subtotal + fee}`}
                </button>
                {!config.razorpay && <div className="note">Demo mode: payment is mocked (no Razorpay keys set).</div>}
                {err && <div className="error">{err}</div>}
            </div>
        </div>
    );
}