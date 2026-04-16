# Label Printing Guide

Smelly Melly uses **Niimbot** label printer with **50 x 30 mm** label paper for product labels. Each product gets a **front label** and a **back label**.

---

## Label Layout

### Front Label (50 x 30 mm)
```
     Smelly Mellys
     240-362-9354

      Lemon Frost
       Body Scrub
```
- Line 1: Business name
- Line 2: Phone number
- Blank line
- Scent name
- Product type (category name)

### Back Label (50 x 30 mm)
```
      INGREDIENTS
  Shea Butter, Coconut Oil,
  Sugar, Lemon Essential Oil,
       Vitamin E
```
- "Ingredients" header
- Comma-separated ingredient list (no percentages)

---

## How Products Map to Labels

There are two patterns depending on how the product was set up:

| Pattern | Example | Labels Generated |
|---------|---------|-----------------|
| **Single scent** — scent is on the product, variants are sizes | Lip Balm (Lavender Dreams) in 8oz | 1 front + 1 back |
| **Multi scent** — scent is blank, each variant IS a scent | Ass Itch Cream with 17 scent variants | 17 fronts + 17 backs |

---

## Setup (One Time)

1. **Add ingredients to each product:**
   - Go to Admin > Products > click a product
   - Fill in the **Ingredients** field (comma-separated)
   - Save

---

## Printing Labels

### Option A: Download PNGs for Niimbot App (Recommended)

This is the easiest method using Melly's existing Niimbot printer and iPhone.

1. Open the admin site on your phone: `http://100.115.11.109:3002/admin`
2. Go to **Products** > tap the product you want labels for
3. Tap **Print Labels**
4. You'll see every scent/variant listed with mini previews
5. Tap **Front PNG** or **Back PNG** next to a scent to download that label as an image
6. Open the **Niimbot app** on your iPhone
7. Create a new label > **Import Image** > select the downloaded PNG
8. Set paper size to **50 x 30 mm**
9. Print

### Option B: Browser Print (AirPrint / USB Label Printer)

If you have an AirPrint-compatible label printer (like a Brother QL-810W):

1. Open the labels page for a product in the admin
2. Check/uncheck which scents you want to print
3. Set the number of **copies** per label
4. Click **Print Labels**
5. In the print dialog:
   - Paper size: **50 x 30 mm** (or custom: 50mm wide, 30mm tall)
   - Margins: **None**
   - Scale: **100%**
6. Labels print as front, back, front, back... (one label per page)

---

## Tips

- **Bulk printing:** Use "Select All" to print every scent variant at once. Set copies to match how many jars/tins you made.
- **Ingredients are shared** across all scents of the same product. If Ass Itch Cream has 17 scents, they all get the same back label.
- **Long scent names** will auto-scale on the downloaded PNG. If a name is super long, it may look cramped — consider abbreviating.
- **Preview before printing** — the labels page shows a mini preview of every front and back label so you can eyeball them before wasting paper.

---

## Future Upgrade Path

If the PNG download workflow gets annoying, a **Brother QL-810W** (~$100) supports AirPrint, which means you can print directly from Safari on your phone with no extra app needed. It uses DK-series label rolls (not Niimbot paper).
