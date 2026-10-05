# Pages: Sponsors & Donations (`/sponsors/` and `/sponsors-2/`)

Two distinct pages share the "Sponsors" concept:

| Page | Purpose | Menu target |
|------|---------|-------------|
| `/sponsors/` | **Donations** — how to give money (check, PayPal, AmazonSmile, eScrip, iGive, advertise) | not in menu |
| `/sponsors-2/` | **Sponsor logos** wall (businesses that sponsor SDCA) | "Sponsors" menu item |

---

## 1. `/sponsors/` — Making a Tax Deductible Donation

- **URL**: `https://sandiegochineseschool.com/sponsors/`
- **Raw HTML**: `research/raw/pages/sponsors.html`

### Full text content (verbatim)

> **Making a Tax Deductible Donation**: It is easy to help our school, you can make a tax
> deductible donation by sending a check to our school or make your donation via PayPal by
> clicking the button below.

> **Donation by check**: If you are making a donation by check, please mail your check to
> **San Diego Chinese Academy, P.O. Box 910093, San Diego, CA 92191-0093**. We will send
> you a receipt when we receive your check.

> **Donation through PayPal**: To donate through PayPal, simply click on the button below
> and follow the direction. Don't forget to include your name, phone number, and mailing
> address so we can send your tax deductible receipt to you in the mail:

*(PayPal hosted-button form here — see form spec below)*

> **Purchase Scrip on our scrip sale date at school**: We sell scrips/certificates from
> various vendors and stores such as grocery stores, restaurants, retails, and others. If
> you are already doing business with these stores, why not purchase the scrips from our
> school which will help our school raise a little funds. Restaurant scrips also makes
> wonderful gifts, so it's like the Chinese saying, killing two birds with one stone, a
> win-win situation.

> **Shop AmazonSmile and Earn Money for SDCA**: … AmazonSmile … **0.5%** of your eligible
> purchases will be donated automatically to SDCA … Visit
> `http://smile.amazon.com/ch/33-0290580` and login with your existing Amazon account.
> Choose San Diego Chinese Academy as your charity when prompted.

> **Sign up with eScrip**: Sign up with eScrip is a great way to support our school. Our
> school earns contribution from participating merchants when you shop.

> **Help our school by Shopping through iGive**: … over 700 stores including name brands
> such as Macy's, Borders, PetsMart, Pottery Barn, Amazon, and many more.

> **Advertise in our school publications**: Have a business? Why not advertise in our
> school publication? To find out about the opportunity to advertise your business, please
> contact **sdca.board.vice.president@gmail.com**

### PayPal form (from raw HTML)

```html
<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
  <input type="hidden" name="cmd" value="_xclick">
  <input type="hidden" name="hosted_button_id" value="...">
  <input type="image" name="submit" ...>
</form>
```
(The `hosted_button_id` value is not exposed in the crawl's `forms` array — it is a
PayPal hosted button.)

### Images

- `SDCA-Header-2018.png` (global header)
- `amazon-smile-small-1.jpg` (4,028 B)
- `escrip-small.jpg`

### Broken link found here (from `broken_links.json`)

- `http://www.sandiegochineseschool.com/SDCA_Donation_Form%20-%202008.pdf` → **404**
  (an old 2008 donation form PDF, linked somewhere on this page family).

---

## 2. `/sponsors-2/` — Sponsor logo wall

- **URL**: `https://sandiegochineseschool.com/sponsors-2/`
- **Raw HTML**: `research/raw/pages/sponsors-2.html`
- **Heading**: 贊助商 Sponsors

### Content

A logo grid (no per-sponsor text in the crawl). Sponsor logos present:

| Logo file (local path) | Business |
|------------------------|----------|
| `99Ranch2018Banner.jpg` | 99 Ranch Market |
| `Mandrin-House.jpeg` | Mandrin House |
| `Law-Offices-of-Peter-Darwin-Chu.png` | Law Offices of Peter Darwin Chu |
| `C2-Education.png` | C2 Education |
| `Dr.-Liu-ad-banner1.png` | Dr. Liu (ad banner) |
| `GoldenVisionBanner.png` | Golden Vision |
| `East-West-Bank.png` | East West Bank |

Plus `SDCA-Header-2018.png` (global header).

### Forms / embeds

None.
