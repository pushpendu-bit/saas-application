from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    identifier = Column(String, unique=True, index=True, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=now)


class Otp(Base):
    __tablename__ = "otps"
    id = Column(Integer, primary_key=True)
    identifier = Column(String, index=True, nullable=False)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=now)


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, index=True, nullable=False)
    price = Column(Integer, nullable=False)  # rupees
    unit = Column(String, default="")
    stock = Column(Integer, default=0)
    emoji = Column(String, default="🛒")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    # pending_payment, placed, accepted, packing, out_for_delivery, delivered, rejected
    status = Column(String, default="pending_payment")
    payment_status = Column(String, default="unpaid")  # unpaid, paid, refund_pending
    subtotal = Column(Integer, default=0)
    delivery_fee = Column(Integer, default=0)
    total = Column(Integer, default=0)
    lat = Column(Float)
    lng = Column(Float)
    address = Column(String, default="")
    razorpay_order_id = Column(String, nullable=True)
    payment_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)
    out_at = Column(DateTime(timezone=True), nullable=True)
    items = relationship("OrderItem", cascade="all, delete-orphan")
    user = relationship("User")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    name = Column(String)
    price = Column(Integer)
    qty = Column(Integer)