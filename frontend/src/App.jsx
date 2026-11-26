import { useEffect, useState } from "react";
import { api, getToken } from "./api";
import Login from "./Login";
import Shop from "./Shop";
import Checkout from "./Checkout";
import { OrderList, Track } from "./Orders";
import Owner from "./Owner";

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [view, setView] = useState("shop");
  const [trackId, setTrackId] = useState(null);
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState({ shop: { lat: 22.5726, lng: 88.3639 }, razorpay: false });
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem("cart") || "{}"));
  const [err, setErr] = useState("");

  useEffect(() => localStorage.setItem("cart", JSON.stringify(cart)), [cart]);
  useEffect(() => {
    const token = getToken();

    if (!token) {
      setAuthChecking(false);
      return;
    }

    api.get("/me")
      .then((data) => {
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    const out = () => logout();
    window.addEventListener("haat-logout", out);
    return () => window.removeEventListener("haat-logout", out);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get("/products").then(setProducts).catch((e) => setErr("Cannot reach server: " + e.message));
    api.get("/config").then(setConfig).catch(() => { });
  }, [user]);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setView("shop");
  }

  function setQty(id, n) {
    setCart((c) => {
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  if (authChecking) return <p>Checking login...</p>;

  if (!user) return <Login onLogin={(data) => {
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
  }} />;

  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const go = (v) => () => setView(v);

  return (
    <>
      <header className="nav">
        <div className="brand" onClick={go("shop")}>🧺 Haat</div>
        <nav>
          <button className={view === "shop" ? "on" : ""} onClick={go("shop")}>Shop</button>
          <button className={view === "cart" ? "on" : ""} onClick={go("cart")}>Cart ({count})</button>
          <button className={view === "orders" ? "on" : ""} onClick={go("orders")}>Orders</button>
          {user.is_admin && <button className={view === "owner" ? "on" : ""} onClick={go("owner")}>Shop owner</button>}
          <button onClick={logout}>Logout</button>
        </nav>
      </header>
      <main className="container">
        {err && <div className="error">{err}</div>}
        {view === "shop" && <Shop products={products} cart={cart} setQty={setQty} />}
        {view === "cart" && (
          <Checkout
            products={products}
            cart={cart}
            setQty={setQty}
            clearCart={() => setCart({})}
            config={config}
            onDone={(id) => {
              setTrackId(id);
              setView("track");
            }}
          />
        )}
        {view === "orders" && (
          <OrderList
            onOpen={(id) => {
              setTrackId(id);
              setView("track");
            }}
          />
        )}
        {view === "track" && trackId && <Track id={trackId} />}
        {view === "owner" && user.is_admin && <Owner />}
      </main>
    </>
  );
}