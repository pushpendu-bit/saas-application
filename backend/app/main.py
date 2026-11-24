import hashlib
import hmac
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

import jwt
import requests
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from . import config, models
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Haat API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
bearer = HTTPBearer(auto_error=False)
RZP_ON = bool(config.RAZORPAY_KEY_ID and config.RAZORPAY_KEY_SECRET)


def now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- auth helpers
def normalize(ident: str) -> str:
    ident = ident.strip().lower()
    if "@" in ident:
        if "." not in ident.split("@")[-1]:
            raise HTTPException(400, "Enter a valid email")
        return ident
    digits = "".join(c for c in ident if c.isdigit())
    if len(digits) == 10:
        return "+91" + digits
    if ident.startswith("+") and 11 <= len(digits) <= 15:
        return "+" + digits
    raise HTTPException(400, "Enter a valid email or 10-digit phone number")


def hash_code(code: str) -> str:
    return hashlib.sha256((code + config.JWT_SECRET).encode()).hexdigest()


def send_otp(ident: str, code: str):
    print(f"[OTP] {ident} -> {code}")
    if "@" in ident and config.SMTP_HOST and config.SMTP_USER:
        try:
            msg = EmailMessage()
            msg["Subject"] = "Your Haat login code"
            msg["From"] = config.SMTP_USER
            msg["To"] = ident
            msg.set_content(f"Your Haat OTP is {code}. It expires in 5 minutes.")
            with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as s:
                s.starttls()
                s.login(config.SMTP_USER, config.SMTP_PASS)
                s.send_message(msg)
        except Exception as e:  # don't break login if mail fails
            print("[OTP] email failed:", e)
    # SMS (Twilio) can be added here for phone numbers.


def make_token(user: models.User) -> str:
    payload = {"sub": str(user.id), "exp": now() + timedelta(days=7)}
    return jwt.encode(payload, config.JWT_SECRET, algorithm="HS256")


def current_user(
    cred: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)
) -> models.User:
    if not cred:
        raise HTTPException(401, "Login required")
    try:
        data = jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, login again")
    user = db.get(models.User, int(data["sub"]))
    if not user:
        raise HTTPException(401, "User not found")
    return user


def admin_user(user: models.User = Depends(current_user)) -> models.User:
    if not user.is_admin:
        raise HTTPException(403, "Shop owner only")
    return user


# ---------------------------------------------------------------- auth routes
class IdentBody(BaseModel):
    identifier: str


class VerifyBody(BaseModel):
    identifier: str
    code: str


@app.post("/auth/request-otp")
def request_otp(body: IdentBody, db: Session = Depends(get_db)):
    ident = normalize(body.identifier)
    last = (
        db.query(models.Otp)
        .filter_by(identifier=ident)
        .order_by(models.Otp.created_at.desc())
        .first()
    )
    if last and (now() - last.created_at).total_seconds() < 30:
        raise HTTPException(429, "Please wait 30 seconds before asking for a new code")
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(models.Otp(identifier=ident, code_hash=hash_code(code), expires_at=now() + timedelta(minutes=5)))
    db.commit()
    send_otp(ident, code)
    res = {"ok": True}
    if config.DEBUG_OTP:
        res["debug_otp"] = code
    return res


@app.post("/auth/verify-otp")
def verify_otp(body: VerifyBody, db: Session = Depends(get_db)):
    ident = normalize(body.identifier)
    otp = (
        db.query(models.Otp)
        .filter_by(identifier=ident)
        .order_by(models.Otp.created_at.desc())
        .first()
    )
    if not otp or otp.expires_at < now():
        raise HTTPException(400, "Code expired. Request a new one")
    if otp.attempts >= 5:
        raise HTTPException(429, "Too many wrong attempts. Request a new code")
    if not hmac.compare_digest(otp.code_hash, hash_code(body.code.strip())):
        otp.attempts += 1
        db.commit()
        raise HTTPException(400, "Wrong code")
    db.query(models.Otp).filter_by(identifier=ident).delete()
    user = db.query(models.User).filter_by(identifier=ident).first()
    if not user:
        user = models.User(identifier=ident)
        db.add(user)
    user.is_admin = ident in config.ADMIN_IDENTIFIERS
    db.commit()
    return {"token": make_token(user), "user": {"identifier": user.identifier, "is_admin": user.is_admin}}


# ---------------------------------------------------------------- catalog
@app.get("/config")
def get_config():
    return {"shop": {"lat": config.SHOP_LAT, "lng": config.SHOP_LNG}, "razorpay": RZP_ON}


@app.get("/products")
def products(db: Session = Depends(get_db)):
    rows = db.query(models.Product).order_by(models.Product.category, models.Product.name).all()
    return [
        {"id": p.id, "name": p.name, "category": p.category, "price": p.price,
         "unit": p.unit, "stock": p.stock, "emoji": p.emoji}
        for p in rows
    ]


# ---------------------------------------------------------------- orders
class ItemIn(BaseModel):
    product_id: int
    qty: int


class OrderIn(BaseModel):
    items: list[ItemIn]
    lat: float
    lng: float
    address: str = ""


class PayIn(BaseModel):
    razorpay_payment_id: str = ""
    razorpay_signature: str = ""


def rider_pos(o: models.Order):
    dest = {"lat": o.lat, "lng": o.lng}
    if o.status == "delivered":
        return dest
    if o.status == "out_for_delivery" and o.out_at:
        p = min(1.0, (now() - o.out_at).total_seconds() / 180)  # 3 minute simulated trip
        return {
            "lat": config.SHOP_LAT + (o.lat - config.SHOP_LAT) * p,
            "lng": config.SHOP_LNG + (o.lng - config.SHOP_LNG) * p,
        }
    return None


def order_out(o: models.Order):
    return {
        "id": o.id, "status": o.status, "payment_status": o.payment_status,
        "subtotal": o.subtotal, "delivery_fee": o.delivery_fee, "total": o.total,
        "address": o.address, "lat": o.lat, "lng": o.lng,
        "created_at": o.created_at.isoformat(),
        "customer": o.user.identifier if o.user else "",
        "items": [{"name": i.name, "price": i.price, "qty": i.qty} for i in o.items],
        "shop": {"lat": config.SHOP_LAT, "lng": config.SHOP_LNG},
        "rider": rider_pos(o),
    }


@app.post("/orders")
def create_order(body: OrderIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.items:
        raise HTTPException(400, "Cart is empty")
    order = models.Order(user_id=user.id, lat=body.lat, lng=body.lng, address=body.address[:300])
    subtotal = 0
    for it in body.items:
        p = db.get(models.Product, it.product_id)
        if not p or not (1 <= it.qty <= 20):
            raise HTTPException(400, "Invalid item")
        if p.stock < it.qty:
            raise HTTPException(409, f"Only {p.stock} left of {p.name}")
        subtotal += p.price * it.qty  # price always taken from the database
        order.items.append(models.OrderItem(product_id=p.id, name=p.name, price=p.price, qty=it.qty))
    order.subtotal = subtotal
    order.delivery_fee = 0 if subtotal >= 500 else 30
    order.total = order.subtotal + order.delivery_fee
    if RZP_ON:
        try:
            r = requests.post(
                "https://api.razorpay.com/v1/orders",
                auth=(config.RAZORPAY_KEY_ID, config.RAZORPAY_KEY_SECRET),
                json={"amount": order.total * 100, "currency": "INR", "receipt": f"haat_{secrets.token_hex(4)}"},
                timeout=15,
            )
            r.raise_for_status()
            order.razorpay_order_id = r.json()["id"]
        except Exception as e:
            raise HTTPException(502, f"Payment gateway error: {e}")
    db.add(order)
    db.commit()
    return {"id": order.id, "total": order.total, "razorpay_order_id": order.razorpay_order_id,
            "key_id": config.RAZORPAY_KEY_ID}


@app.post("/orders/{oid}/pay")
def pay_order(oid: int, body: PayIn, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    o = db.get(models.Order, oid)
    if not o or o.user_id != user.id:
        raise HTTPException(404, "Order not found")
    if o.status != "pending_payment":
        raise HTTPException(400, "Order already paid")
    if RZP_ON:
        msg = f"{o.razorpay_order_id}|{body.razorpay_payment_id}".encode()
        expected = hmac.new(config.RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, body.razorpay_signature):
            raise HTTPException(400, "Payment verification failed")
        o.payment_id = body.razorpay_payment_id
    else:
        o.payment_id = "mock_" + secrets.token_hex(4)
    for it in o.items:
        p = db.get(models.Product, it.product_id)
        if p.stock < it.qty:
            raise HTTPException(409, f"{p.name} just went out of stock")
        p.stock -= it.qty
    o.status = "placed"
    o.payment_status = "paid"
    db.commit()
    return order_out(o)


@app.get("/orders")
def my_orders(user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Order)
        .filter(models.Order.user_id == user.id, models.Order.status != "pending_payment")
        .order_by(models.Order.id.desc())
        .all()
    )
    return [order_out(o) for o in rows]


@app.get("/orders/{oid}")
def get_order(oid: int, user: models.User = Depends(current_user), db: Session = Depends(get_db)):
    o = db.get(models.Order, oid)
    if not o or (o.user_id != user.id and not user.is_admin):
        raise HTTPException(404, "Order not found")
    return order_out(o)


# ---------------------------------------------------------------- shop owner
FLOW = {
    "placed": ["accepted", "rejected"],
    "accepted": ["packing"],
    "packing": ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
}


class StatusIn(BaseModel):
    status: str


@app.get("/owner/orders")
def owner_orders(_: models.User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = (
        db.query(models.Order)
        .filter(models.Order.status != "pending_payment")
        .order_by(models.Order.id.desc())
        .limit(100)
        .all()
    )
    return [order_out(o) for o in rows]


@app.post("/owner/orders/{oid}/status")
def owner_set_status(oid: int, body: StatusIn, _: models.User = Depends(admin_user), db: Session = Depends(get_db)):
    o = db.get(models.Order, oid)
    if not o:
        raise HTTPException(404, "Order not found")
    if body.status not in FLOW.get(o.status, []):
        raise HTTPException(400, f"Cannot move from {o.status} to {body.status}")
    o.status = body.status
    if body.status == "out_for_delivery":
        o.out_at = now()
    if body.status == "rejected":
        o.payment_status = "refund_pending"
        for it in o.items:  # put stock back
            p = db.get(models.Product, it.product_id)
            if p:
                p.stock += it.qty
    db.commit()
    return order_out(o)