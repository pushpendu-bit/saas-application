import { useState } from "react";

export default function Shop({ products, cart, setQty }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = ["All", ...new Set(products.map((p) => p.category))];
  const list = products.filter(
    (p) => (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <input className="search" placeholder="Search items..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {cats.map((c) => (
          <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="grid">
        {list.map((p) => {
          const n = cart[p.id] || 0;
          return (
            <div className="card product" key={p.id}>
              <div className="emoji">{p.emoji}</div>
              <div className="pname">{p.name}</div>
              <div className="muted">{p.unit}</div>
              <div className="price">₹{p.price}</div>
              {p.stock <= 0 ? (
                <div className="muted">Out of stock</div>
              ) : n === 0 ? (
                <button className="btn small" onClick={() => setQty(p.id, 1)}>Add</button>
              ) : (
                <div className="qty">
                  <button onClick={() => setQty(p.id, n - 1)}>−</button>
                  <span>{n}</span>
                  <button onClick={() => setQty(p.id, Math.min(n + 1, Math.min(20, p.stock)))}>+</button>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && <p className="muted">No items found.</p>}
      </div>
    </div>
  );
}