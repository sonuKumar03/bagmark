from PIL import Image, ImageDraw, ImageFont
import os

width = 1600
height = 1200

# Base canvas
img = Image.new('RGB', (width, height), color='#0F172A')
draw = ImageDraw.Draw(img)

# Gradient background
for y in range(height):
    ratio = y / height
    r = int(15 + ratio * 15)
    g = int(23 + ratio * 20)
    b = int(42 + ratio * 28)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Subtle decorative circle
draw.ellipse([width - 400, -100, width + 300, 600], fill=(245, 158, 11, 15))

# Try default system fonts
try:
    title_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Bold.otf", 56)
    subtitle_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Regular.otf", 26)
    card_title_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Semibold.otf", 20)
    badge_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Medium.otf", 16)
    body_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Regular.otf", 16)
    small_font = ImageFont.truetype("/System/Library/Fonts/SFPro-Regular.otf", 14)
except Exception:
    title_font = subtitle_font = card_title_font = badge_font = body_font = small_font = ImageFont.load_default()

# Header text
draw.text((100, 70), "🎒 BagMark for Firefox", font=title_font, fill="#F8FAFC")
draw.text((100, 140), "Frictionless context-menu bookmarking with date tracking & rich metadata", font=subtitle_font, fill="#94A3B8")

# Feature pills
pills = ["⚡ 1-Click Quick Save", "📅 Auto YYYY-MM Date Folders", "💬 Highlighted Quotes", "🔒 100% Local & Private"]
pill_x = 100
for pill in pills:
    pill_w = len(pill) * 11 + 24
    draw.rounded_rectangle([pill_x, 190, pill_x + pill_w, 226], radius=18, fill="#1E293B", outline="#334155", width=1)
    draw.text((pill_x + 12, 198), pill, font=badge_font, fill="#E2E8F0")
    pill_x += pill_w + 16

# Left Card: Context Menu Mockup
menu_x, menu_y = 120, 320
menu_w, menu_h = 420, 560
# Shadow
draw.rounded_rectangle([menu_x + 8, menu_y + 8, menu_x + menu_w + 8, menu_y + menu_h + 8], radius=16, fill="#050811")
# Body
draw.rounded_rectangle([menu_x, menu_y, menu_x + menu_w, menu_y + menu_h], radius=16, fill="#1E1E24", outline="#3F3F4E", width=2)

draw.text((menu_x + 24, menu_y + 24), "BROWSER CONTEXT MENU", font=badge_font, fill="#F59E0B")

# Webpage context snippet
draw.rounded_rectangle([menu_x + 24, menu_y + 56, menu_x + menu_w - 24, menu_y + 130], radius=8, fill="#2B2B36")
draw.text((menu_x + 36, menu_y + 70), "Right-click on any link or page:", font=small_font, fill="#9CA3AF")
draw.text((menu_x + 36, menu_y + 94), "https://developer.mozilla.org/...", font=card_title_font, fill="#60A5FA")

# Context menu items
items = [
    ("Back", False),
    ("Forward", False),
    ("Reload", False),
    ("---", False),
    ("🎒 Bag It (Save to BagMark)", True),
    ("🎒 Bag It to ▸", False),
    ("---", False),
    ("Inspect Element", False)
]

item_y = menu_y + 150
for label, is_active in items:
    if label == "---":
        draw.line([(menu_x + 20, item_y + 8), (menu_x + menu_w - 20, item_y + 8)], fill="#3F3F4E", width=1)
        item_y += 18
    elif is_active:
        draw.rounded_rectangle([menu_x + 16, item_y, menu_x + menu_w - 16, item_y + 44], radius=6, fill="#F59E0B")
        draw.text((menu_x + 32, item_y + 12), label, font=card_title_font, fill="#121216")
        item_y += 52
    else:
        draw.text((menu_x + 32, item_y + 10), label, font=body_font, fill="#E2E8F0" if "Bag It to" in label else "#94A3B8")
        if "▸" in label:
            draw.text((menu_x + menu_w - 44, item_y + 10), "▸", font=body_font, fill="#F59E0B")
        item_y += 42

# Right Card: Extension Popup Dashboard Mockup
pop_x, pop_y = 660, 270
pop_w, pop_h = 820, 840

# Window frame
draw.rounded_rectangle([pop_x + 10, pop_y + 10, pop_x + pop_w + 10, pop_y + pop_h + 10], radius=20, fill="#050811")
draw.rounded_rectangle([pop_x, pop_y, pop_x + pop_w, pop_y + pop_h], radius=20, fill="#1E1E24", outline="#475569", width=2)

# Window header
draw.rounded_rectangle([pop_x, pop_y, pop_x + pop_w, pop_y + 60], radius=20, fill="#2B2B36")
draw.ellipse([pop_x + 24, pop_y + 24, pop_x + 36, pop_y + 36], fill="#EF4444")
draw.ellipse([pop_x + 44, pop_y + 24, pop_x + 56, pop_y + 36], fill="#F59E0B")
draw.ellipse([pop_x + 64, pop_y + 24, pop_x + 76, pop_y + 36], fill="#10B981")
draw.text((pop_x + 100, pop_y + 18), "BagMark — Saved Bookmarks Dashboard", font=card_title_font, fill="#F8FAFC")
draw.text((pop_x + pop_w - 60, pop_y + 18), "⚙️", font=card_title_font, fill="#9CA3AF")

# Search bar
search_y = pop_y + 80
draw.rounded_rectangle([pop_x + 30, search_y, pop_x + pop_w - 30, search_y + 48], radius=8, fill="#121216", outline="#3F3F4E", width=1)
draw.text((pop_x + 48, search_y + 14), "🔍 Search saved links, tags, quotes...", font=body_font, fill="#9CA3AF")

# Filter stats bar
stats_y = search_y + 62
draw.text((pop_x + 34, stats_y), "3 saved items", font=small_font, fill="#9CA3AF")
draw.rounded_rectangle([pop_x + pop_w - 180, stats_y - 4, pop_x + pop_w - 30, stats_y + 24], radius=6, fill="#2B2B36", outline="#3F3F4E")
draw.text((pop_x + pop_w - 164, stats_y + 1), "📁 All Folders ▾", font=small_font, fill="#E2E8F0")

# Bookmark Cards
cards = [
    {
        "title": "MDN Web Docs — JavaScript Reference",
        "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
        "folder": "BagMark / 2026-09",
        "time": "5m ago",
        "quote": "JavaScript is a lightweight, interpreted, object-oriented language with first-class functions."
    },
    {
        "title": "Vite: Next Generation Frontend Tooling",
        "url": "https://vite.dev/guide/",
        "folder": "Dev / Tools",
        "time": "2h ago",
        "quote": None
    },
    {
        "title": "Firefox WebExtensions API Documentation",
        "url": "https://extensionworkshop.com/documentation/develop/",
        "folder": "BagMark / 2026-09",
        "time": "Yesterday",
        "quote": "WebExtensions is a cross-browser system for developing extensions."
    }
]

card_y = stats_y + 36
for c in cards:
    card_h = 160 if c["quote"] else 115
    draw.rounded_rectangle([pop_x + 30, card_y, pop_x + pop_w - 30, card_y + card_h], radius=10, fill="#2B2B36", outline="#3F3F4E", width=1)
    
    # Title
    draw.text((pop_x + 48, card_y + 14), c["title"], font=card_title_font, fill="#F8FAFC")
    
    # Quote
    text_y = card_y + 44
    if c["quote"]:
        draw.rounded_rectangle([pop_x + 48, text_y, pop_x + pop_w - 48, text_y + 38], radius=4, fill="#1E1E24")
        draw.line([(pop_x + 48, text_y), (pop_x + 48, text_y + 38)], fill="#F59E0B", width=3)
        draw.text((pop_x + 58, text_y + 10), f'"{c["quote"]}"', font=small_font, fill="#CBD5E1")
        text_y += 48

    # Metadata & actions
    draw.rounded_rectangle([pop_x + 48, text_y + 4, pop_x + 48 + len(c["folder"]) * 9 + 20, text_y + 26], radius=4, fill="#3F3F4E")
    draw.text((pop_x + 56, text_y + 7), f"📁 {c['folder']}", font=small_font, fill="#E2E8F0")
    draw.text((pop_x + 56 + len(c["folder"]) * 9 + 30, text_y + 7), f"🕒 {c['time']}", font=small_font, fill="#9CA3AF")
    
    # Buttons
    draw.rounded_rectangle([pop_x + pop_w - 170, text_y + 2, pop_x + pop_w - 110, text_y + 28], radius=4, outline="#475569")
    draw.text((pop_x + pop_w - 156, text_y + 6), "Copy", font=small_font, fill="#E2E8F0")
    draw.rounded_rectangle([pop_x + pop_w - 100, text_y + 2, pop_x + pop_w - 42, text_y + 28], radius=4, outline="#EF4444")
    draw.text((pop_x + pop_w - 90, text_y + 6), "Delete", font=small_font, fill="#EF4444")

    card_y += card_h + 16

os.makedirs("public/assets", exist_ok=True)
output_path = "public/assets/screenshot-dashboard.png"
img.save(output_path, "PNG")
print(f"Successfully generated {output_path}")
