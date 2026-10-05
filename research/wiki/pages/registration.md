# Page: Registration (`/registration/`)

- **Title**: Registration – San Diego Chinese Academy 聖地牙哥中華學苑
- **URL**: `https://sandiegochineseschool.com/registration/`
- **Menu label**: "Enroll"
- **Type**: WordPress page
- **Raw HTML**: `research/raw/pages/registration.html`

## Purpose

The registration **landing page** on the main domain. Actual enrollment happens on the
external subdomain **`register.sandiegochineseschool.com`** (a separate Rails app).

## Full text content (verbatim)

> 2026-2027 學年度網上註冊 Online Registration
>
> 我們不再接受郵寄註冊. 請在九月十三日開學日到辦公室辦理註冊.
> We are no longer accepting registration by mail. Please submit the Registration Form
> and your payment to the office on the first day of school, September 13.

### Link blocks (anchors → targets)

| Anchor (ZH / EN) | Target URL |
|------------------|------------|
| 註冊須知與網路註冊說明 / Registration Notice and Online Registration Instructions (ZH) | `https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20Chinese.pdf` |
| Registration Notice and Online Registration Instructions (EN) | `https://register.sandiegochineseschool.com/public/upload/Registration%20Notice%20English.pdf` |
| 義工工作說明 / Volunteer Job Descriptions | `/volunteer-opportunity/` (on-page reference) |
| 新家庭註冊 / New Family Sign Up | `https://register.sandiegochineseschool.com/signin/register` |
| 舊生註冊 / Returning Student Sign In | `https://register.sandiegochineseschool.com/signin` |

> 如果有任何問題, 請 email 或是洽電 (858)205-7322.
> If you have any questions, please email or contact us at (858)205-7322.

## Images

- `SDCA-Header-2018.png` (global header)
- `SDCA-Ad-half-page-1024x663.jpg` (ad graphic)

## The external registration portal (`register.sandiegochineseschool.com`)

Documented **read-only** (no submissions made). Fetched `GET /` and public PDFs.

### Root page (`https://register.sandiegochineseschool.com/`)

- **Title**: `Sign In`
- **Stack**: Ruby on Rails (asset paths `/assets/stylesheets/application.css`,
  jQuery-UI theme images), Apache 2.4.68 / Debian.
- **Sign-in form fields** (GET form):
  - `Username 用戶名稱:` (text input)
  - `Password 密碼:` (password input)
  - Buttons: Sign In
  - Links: "Forgot username? Try to find username here 查詢用戶名稱" → `/forgot_username`
  - Links: "Forgot password? Request password reset here 重建密碼" → `/forgot_password`
  - "New to San Diego Chinese Academy? Register here 新學生家長請由此登入" → `/signin/register`
  - Help: "Should you require any further assistance, please contact 若需任何協助, 請寄電子郵件至
    office.sdca@gmail.com" → `mailto:office.sdca@gmail.com`

### Public PDF documents on the portal

| Anchor (ZH/EN) | URL | Downloaded |
|----------------|-----|------------|
| Registration Notice & Online Registration FAQ 註冊須知與網上註冊常見問答集 | `https://register.sandiegochineseschool.com/Registration%20Notice%20English.pdf` | ✅ saved to `research/assets/pdf/registration-portal/reg_notice.pdf` (1,131,657 bytes, 4 pp.) |
| (ZH) | `…/Registration%20Notice%20Chinese.pdf` | ✅ `reg_Registration_Notice_Chinese.pd.pdf` (1,032,709 bytes) |
| Online Registration User Guide 網上註冊說明 | `…/Online Registration User Guide.pdf` | ✅ `reg_Online_Registration_User_Guide.pdf` (1,511,214 bytes) |
| General Class Information 課程簡介 | `…/class-placement` (links back to main site `/class-placement/`) | — |
| Portal Manual 使用手冊 | `…/SDCA School Portal User Manual (User Edition).pdf` | ✅ `reg_SDCA_School_Portal_User_Manual.pdf` (2,979,232 bytes) |
| Privacy Policy 隱私權須知 | `…/privacy.html` | ✅ fetched (`/tmp/reg_privacy.html`); collects name, email, address, phone when registering or paying |

> Note: the main site's `/registration/` page also links to the *same* two Registration
> Notice PDFs (hosted on the register subdomain), while the main site's media library
> carries an older copy at `/wp-content/uploads/2020/Registration Notice Chinese.pdf`
> (sha256 `0ace3a6c…`, 1,028,459 bytes — **different** file from the portal's copy).

### Registration flow (as documented on the site)

1. New family → `register…/signin/register` (register an account).
2. Returning family → `register…/signin` (sign in).
3. Fill registration form, submit payment in the portal.
4. **Policy (2026-27)**: mail registration is no longer accepted; the registration
   form + payment must be submitted **in person at the office on the first day of
   school, September 13** (per the main-site `/registration/` page text).

## Broken links found on this page

- `https://sandiegochineseschool.com/registration/signin` → **404** (listed in
  `broken_links.json`)
- `https://sandiegochineseschool.com/registration/signin/register` → **404**

## Forms / embeds

No inline form on the main-domain page; all form handling is on the subdomain.
