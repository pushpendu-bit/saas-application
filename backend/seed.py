from app.database import Base, engine, SessionLocal
from app import models

PRODUCTS = [
    ("Basmati Rice", "Grocery", 120, "1 kg", "🍚"),
    ("Toor Dal", "Grocery", 150, "1 kg", "🫘"),
    ("Whole Wheat Atta", "Grocery", 260, "5 kg", "🌾"),
    ("Sugar", "Grocery", 48, "1 kg", "🍬"),
    ("Mustard Oil", "Grocery", 170, "1 L", "🛢️"),
    ("Tomato", "Fruits & Veg", 40, "1 kg", "🍅"),
    ("Potato", "Fruits & Veg", 30, "1 kg", "🥔"),
    ("Onion", "Fruits & Veg", 35, "1 kg", "🧅"),
    ("Banana", "Fruits & Veg", 60, "1 dozen", "🍌"),
    ("Apple", "Fruits & Veg", 180, "1 kg", "🍎"),
    ("Milk", "Dairy", 62, "1 L", "🥛"),
    ("Paneer", "Dairy", 90, "200 g", "🧀"),
    ("Curd", "Dairy", 45, "400 g", "🥣"),
    ("Butter", "Dairy", 58, "100 g", "🧈"),
    ("Nolen Gur", "Local Special", 220, "500 g", "🍯"),
    ("Gamchha", "Local Special", 150, "1 piece", "🧣"),
    ("Mishti Doi", "Local Special", 120, "400 g", "🍮"),
    ("Gobindobhog Rice", "Local Special", 140, "1 kg", "🌾"),
    ("Dish Wash Liquid", "Household", 95, "500 ml", "🧴"),
    ("Detergent Powder", "Household", 130, "1 kg", "🧺"),
]

Base.metadata.create_all(bind=engine)
db = SessionLocal()
if db.query(models.Product).count() == 0:
    for name, cat, price, unit, emoji in PRODUCTS:
        db.add(models.Product(name=name, category=cat, price=price, unit=unit, stock=50, emoji=emoji))
    db.commit()
    print("Seeded", len(PRODUCTS), "products")
else:
    print("Products already exist, nothing to do")
db.close()