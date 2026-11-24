import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = (e) =>
    L.divIcon({
        html: `<div style="font-size:26px;line-height:30px">${e}</div>`,
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 28],
    });

export default function MapView({ shop, dest, rider, onPick, height = 320 }) {
    const el = useRef(null);
    const map = useRef(null);
    const markers = useRef({});
    const pickRef = useRef(onPick);
    pickRef.current = onPick;

    useEffect(() => {
        const c = dest || shop;
        map.current = L.map(el.current).setView([c.lat, c.lng], 13);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "© OpenStreetMap contributors",
        }).addTo(map.current);
        map.current.on("click", (e) => pickRef.current && pickRef.current(e.latlng.lat, e.latlng.lng));
        return () => {
            map.current.remove();
            markers.current = {};
        };
    }, []);

    useEffect(() => {
        const put = (key, p, emoji) => {
            const m = markers.current;
            if (!p) {
                if (m[key]) {
                    m[key].remove();
                    delete m[key];
                }
                return;
            }
            if (m[key]) m[key].setLatLng([p.lat, p.lng]);
            else m[key] = L.marker([p.lat, p.lng], { icon: icon(emoji) }).addTo(map.current);
        };
        put("shop", shop, "🏪");
        put("dest", dest, "📍");
        put("rider", rider, "🛵");
    }, [shop, dest, rider]);

    return <div ref={el} className="map" style={{ height }} />;
}