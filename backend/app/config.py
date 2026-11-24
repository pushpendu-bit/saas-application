import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:password@localhost:5432/haat")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
DEBUG_OTP = os.getenv("DEBUG_OTP", "true").lower() == "true"
ADMIN_IDENTIFIERS = [x.strip().lower() for x in os.getenv("ADMIN_IDENTIFIERS", "").split(",") if x.strip()]
SHOP_LAT = float(os.getenv("SHOP_LAT", "22.5726"))
SHOP_LNG = float(os.getenv("SHOP_LNG", "88.3639"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASS = os.getenv("SMTP_PASS", "")