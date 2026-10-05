#!/usr/bin/env python3
"""SDCA site crawler. Python3 stdlib only. See task spec for full requirements."""
import json, hashlib, io, os, re, struct, sys, time, urllib.request, urllib.parse, urllib.error
from html.parser import HTMLParser

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # /Users/Maxi/Code/SDCA
RESEARCH = os.path.join(BASE, "research")
HOST = "sandiegochineseschool.com"
ALLOWED_HOSTS = {HOST, "www." + HOST}
UA = "Mozilla/5.0 (SDCA-research)"
DELAY = 0.4
RETRIES = 4
TIMEOUT = 30
MAX_PAGES = 3000
BASEURL = "https://" + HOST
START = BASEURL + "/"

DATA = os.path.join(RESEARCH, "data")
RAW_PAGES = os.path.join(RESEARCH, "raw", "pages")
ASSETS = {
    "images": os.path.join(RESEARCH, "assets", "images"),
    "pdf": os.path.join(RESEARCH, "assets", "pdf"),
    "docs": os.path.join(RESEARCH, "assets", "docs"),
    "media": os.path.join(RESEARCH, "assets", "media"),
}
RAW_ASSETS = {"css": os.path.join(RESEARCH, "raw", "assets", "css"),
              "js": os.path.join(RESEARCH, "raw", "assets", "js")}
LOGS = os.path.join(RESEARCH, "logs")
for d in [DATA, RAW_PAGES, LOGS] + list(ASSETS.values()) + list(RAW_ASSETS.values()):
    os.makedirs(d, exist_ok=True)

_LOGF = open(os.path.join(LOGS, "crawl.log"), "a", encoding="utf-8")
def log(msg):
    line = "[%s] %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)
    _LOGF.write(line + "\n"); _LOGF.flush()

_last_req = [0.0]
def _throttle():
    wait = _last_req[0] + DELAY - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_req[0] = time.time()

def http_get(url, timeout=TIMEOUT):
    """Returns (status, final_url, bytes, content_type). Retries with backoff."""
    last_err = None
    # encode non-ASCII path chars (urllib requires ASCII)
    import urllib.parse as _P
    sp = _P.urlsplit(url)
    path = _P.quote(_P.unquote(sp.path), safe="/%")
    url = sp._replace(path=path).geturl()
    for attempt in range(RETRIES):
        _throttle()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            r = urllib.request.urlopen(req, timeout=timeout)
            return r.status, r.geturl(), r.read(), r.headers.get("Content-Type", "")
        except urllib.error.HTTPError as e:
            # 4xx/5xx: don't retry 404/400, do retry 429/5xx
            body = b""
            try:
                body = e.read()
            except Exception:
                pass
            if e.code in (404, 400, 401, 403):
                return e.code, url, body, e.headers.get("Content-Type","") if e.headers else ""
            last_err = e
        except Exception as e:
            last_err = e
        time.sleep(1.5 * (attempt + 1))
    return ("ERR:" + str(last_err)[:60], url, b"", "")

def host_of(u):
    p = urllib.parse.urlsplit(u)
    h = (p.hostname or "").lower()
    return h

def is_internal(url):
    return host_of(url) in ALLOWED_HOSTS

SKIP_LINK = re.compile(r"(wp-login|xmlrpc|wp-admin|replytocom|\?share|wp-comments-post)", re.I)
def normalize(url, base=None):
    """Resolve, strip fragment, drop junk query params; return canonical https url or None."""
    if not url or url.startswith(("javascript:", "mailto:", "tel:", "data:", "#")):
        return None
    u = url.strip()
    if base and not u.startswith(("http://", "https://")):
        u = urllib.parse.urljoin(base, u)
    sp = urllib.parse.urlsplit(u)
    if sp.scheme not in ("http", "https"):
        return None
    host = (sp.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    if host != HOST:
        return None
    if SKIP_LINK.search(u):
        return None
    path = urllib.parse.quote(urllib.parse.unquote(sp.path), safe="/%") or "/"
    # filter junk query params, keep p/page_id/paged/attachment etc.
    keep = []
    for k, v in urllib.parse.parse_qsl(sp.query, keep_blank_values=True):
        if SKIP_LINK.search(k) or k in ("s", "share"):
            continue
        keep.append(k + ("=" + urllib.parse.quote(v, safe="") if v else ""))
    q = "&".join(keep)
    return "https://" + HOST + path + ("?" + q if q else "")

EXT_IMAGE = re.compile(r"\.(png|jpe?g|gif|webp|svg|ico|avif)(\?|$)", re.I)
EXT_PDF = re.compile(r"\.pdf(\?|$)", re.I)
EXT_DOC = re.compile(r"\.(doc|docx|xls|xlsx|ppt|pptx|zip)(\?|$)", re.I)
EXT_MEDIA = re.compile(r"\.(mp3|mp4|wav|ogg|webm|mov|m4a|flac)(\?|$)", re.I)
IMG_SIZE_SUFFIX = re.compile(r"-(\d{2,4})x(\d{2,4})(\.\w+)$")

def read_image_size(path):
    """Return (w,h) from PNG/JPEG/GIF header or None."""
    try:
        with open(path, "rb") as f:
            d = f.read(32)
        if d[:8] == b"\x89PNG\r\n\x1a\n":
            w, h = struct.unpack(">II", d[16:24])
            return w, h
        if d[:3] == b"GI\x8f":
            w, h = struct.unpack("<HH", d[6:10])
            return w, h
        if d[:2] == b"\xff\xd8":
            i = 2
            while i < len(d) - 9:
                if d[i] != 0xFF:
                    i += 1; continue
                m = d[i + 1]
                if m in (0xC0, 0xC1, 0xC2, 0xC3):
                    h, w = struct.unpack(">HH", d[i + 5:i + 9])
                    return w, h
                if m in (0xD8, 0x01) or (0xD0 <= m <= 0xD7):
                    i += 2
                else:
                    seglen = struct.unpack(">H", d[i + 2:i + 4])[0]
                    i += 2 + seglen
    except Exception:
        pass
    return None

# ---------------- HTML parsing ----------------
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}
SKIP_TEXT = {"script","style","noscript","template"}
REGION_TAGS = {"nav", "footer", "form", "ul", "ol", "div", "section", "header", "main", "article", "aside"}

class PageParser(HTMLParser):
    """Single-pass extraction: title/meta/outline/text-regions/links/images/forms/iframes/plugins."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self.html_lang = None
        self.meta_desc = ""
        self.outline = []           # [{"level":1,"text":".."}]
        self._heading = None        # (level, buf)
        self.text_main = []
        self.text_nav = []
        self.text_footer = []
        self._region = None         # current nav/footer region tag or None
        self._region_stack = []
        self.links = []             # {href, text}
        self._a = None              # [href, textbuf]
        self.images = []            # {src, alt, w, h}
        self.forms = []
        self._form = None
        self._skip_depth = 0
        self.iframes = []
        self.plugins = set()
        self.theme = None
        self.script_srcs = set()
        self.style_hrefs = set()
        self._input_pending = None
        self._last_label = ""

    def _plugin_from(self, url):
        m = re.search(r"/wp-content/plugins/([a-z0-9_-]+)/", url or "")
        if m: self.plugins.add(m.group(1))
        m = re.search(r"/wp-content/themes/([a-z0-9_-]+)/", url or "")
        if m and not self.theme: self.theme = m.group(1)
        m = re.search(r"/wp-includes/|/wp-emoji", url or "")
        # wp-includes is core, not a plugin

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TEXT:
            self._skip_depth += 1
            return
        a = dict(attrs)
        if tag == "html":
            self.html_lang = a.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta" and (a.get("name") or "").lower() == "description":
            self.meta_desc = a.get("content", "")
        elif tag in ("h1","h2","h3"):
            self._heading = (int(tag[1]), [])
        elif tag in ("nav","footer"):
            self._region_stack.append(tag)
            self._region = tag
        elif tag == "a" and self._a is None:
            self._a = [a.get("href") or "", ""]
        elif tag == "img":
            self._plugin_from(a.get("src"))
            self.images.append({"src": a.get("src") or "", "alt": a.get("alt") or "",
                                "w": a.get("width"), "h": a.get("height")})
        elif tag == "form":
            self._form = {"action": a.get("action") or "", "method": (a.get("method") or "get").lower(),
                          "fields": [], "plugin": self._guess_form_plugin(a)}
        elif tag in ("input","select","textarea"):
            if self._form is not None:
                self._form["fields"].append({
                    "name": a.get("name") or "",
                    "type": a.get("type") or tag,
                    "label": self._last_label,
                    "required": a.get("required") is not None or "required" in (a.get("class") or ""),
                    "id": a.get("id") or "",
                })
        elif tag == "iframe":
            self.iframes.append(a.get("src") or "")
        elif tag == "script" and a.get("src"):
            self._plugin_from(a.get("src"))
            self.script_srcs.add(a.get("src"))
        elif tag == "link" and a.get("rel") in ("stylesheet", "alternate"):
            self._plugin_from(a.get("href"))
            self.style_hrefs.add(a.get("href"))
        elif tag == "label":
            self._last_label = ""  # will be filled by data
            self._label_collect = True
        elif tag == "button":
            # capture type for donate/submit detection
            pass

    _label_collect = False
    def handle_data(self, data):
        if self._skip_depth: return
        if self._in_title:
            self.title += data
        if self._heading:
            self._heading[1].append(data)
        if self._a is not None:
            self._a[1] += data
        if self._label_collect:
            self._last_label = data
        # region routing
        if self._region_stack:
            if self._region_stack[-1] == "footer":
                self.text_footer.append(data)
            else:
                self.text_nav.append(data)
        else:
            self.text_main.append(data)

    def handle_endtag(self, tag):
        if tag in SKIP_TEXT:
            if self._skip_depth: self._skip_depth -= 1
            return
        if tag == "title":
            self._in_title = False
        elif tag in ("h1","h2","h3") and self._heading:
            txt = "".join(self._heading[1]).strip()
            if txt:
                self.outline.append({"level": self._heading[0], "text": txt})
            self._heading = None
        elif tag in ("nav","footer") and self._region_stack:
            self._region_stack.pop()
            self._region = self._region_stack[-1] if self._region_stack else None
        elif tag == "a" and self._a is not None:
            href, txt = self._a[0], self._a[1].strip()
            if href or txt:
                self.links.append({"href": href, "text": txt})
            self._a = None
        elif tag == "form" and self._form is not None:
            self.forms.append(self._form); self._form = None
        elif tag == "label":
            self._label_collect = False

    def _guess_form_plugin(self, a):
        cls = (a.get("class") or "") + " " + (a.get("id") or "")
        hints = []
        for k in ("wpforms","ninja-forms","wpcf7","contact-form-7","gravity","formidable","fluentform"):
            if k in cls.lower(): hints.append(k)
        return ",".join(hints)

def parse_html(html_text):
    p = PageParser()
    p.feed(html_text)
    p.close()
    def clean(lst):
        out=[]; prev=None
        for s in lst:
            t=re.sub(r"\s+"," ",s).strip()
            if t and t!=prev: out.append(t); prev=t
        return out
    return {
        "title": re.sub(r"\s+"," ",p.title).strip(),
        "lang": p.html_lang,
        "meta_description": p.meta_desc,
        "outline": p.outline,
        "text_main": " ".join(clean(p.text_main))[:20000],
        "text_nav": " ".join(clean(p.text_nav))[:8000],
        "text_footer": " ".join(clean(p.text_footer))[:8000],
        "links": p.links,
        "images": p.images,
        "forms": p.forms,
        "iframes": p.iframes,
        "plugins": sorted(p.plugins),
        "theme": p.theme,
        "script_srcs": sorted(p.script_srcs),
        "style_hrefs": sorted(p.style_hrefs),
    }

# ---------------- Feature detection ----------------
FEAT_RULES = [
    ("slider",       re.compile(r"slider|swiper|flexslider|smart-slider", re.I)),
    ("gallery",      re.compile(r"gallery|envira|nextgen|photo.?album", re.I)),
    ("calendar",     re.compile(r"calendar|events?\.org|tribe|event.?calendar|google.?calendar", re.I)),
    ("donate",       re.compile(r"donate|捐款|donation", re.I)),
    ("registration", re.compile(r"registr|註冊|報名|enroll", re.I)),
    ("language-switcher", re.compile(r"language.?switch|icl-|wpml|多語|language.?select", re.I)),
    ("search",       re.compile(r"search|搜尋|搜索", re.I)),
    ("contact-form", re.compile(r"contact.?form|wpforms|ninja.?form|wpcf7|gravity.?form|formidable", re.I)),
    ("paypal",       re.compile(r"paypal|pp-?button", re.I)),
    ("youtube",      re.compile(r"youtube|youtu\.be", re.I)),
    ("vimeo",        re.compile(r"vimeo", re.I)),
    ("google-maps",  re.compile(r"maps\.google|google.?map", re.I)),
    ("video-embed",  re.compile(r"video|player|embed", re.I)),
    ("facebook",     re.compile(r"facebook", re.I)),
    ("instagram",    re.compile(r"instagram", re.I)),
    ("newsletter",   re.compile(r"newsletter|subscribe|訂閱", re.I)),
    ("elearning",    re.compile(r"moodle|canvas|learn|lms|edcircuit|learn\.dash", re.I)),
    ("payment",      re.compile(r"stripe|square\.|pay\.pal|checkout", re.I)),
]
def detect_features(parsed, html_text):
    feats = set()
    blob = (html_text[:400000] + " " + json.dumps(parsed, ensure_ascii=False))
    for name, rx in FEAT_RULES:
        if rx.search(blob):
            feats.add(name)
    if parsed.get("plugins"):
        for pl in parsed["plugins"]:
            if "donate" in pl or "give" in pl: feats.add("donate")
            if "form" in pl: feats.add("contact-form")
            if "slider" in pl or "swiper" in pl: feats.add("slider")
            if "gallery" in pl: feats.add("gallery")
            if "calendar" in pl or "events" in pl: feats.add("calendar")
            if "language" in pl or "translate" in pl or "wpml" in pl: feats.add("language-switcher")
    # iframe-based
    for fr in parsed.get("iframes", []):
        if "youtube" in fr or "youtu.be" in fr: feats.add("youtube"); feats.add("video-embed")
        if "vimeo" in fr: feats.add("vimeo"); feats.add("video-embed")
        if "google.com/maps" in fr or "maps.google" in fr: feats.add("google-maps")
        if "calendar" in fr: feats.add("calendar")
        if "facebook" in fr: feats.add("facebook")
    # forms
    for f in parsed.get("forms", []):
        if f.get("plugin") or any("contact" in (x.get("name") or "") for x in f.get("fields",[])):
            feats.add("contact-form")
        if any(x.get("type") in ("email","tel","file") for x in f.get("fields",[])):
            feats.add("contact-form")
    return sorted(feats)

# ---------------- Asset download ----------------
def asset_kind(url):
    """Return one of images/pdf/docs/media/css/js or None."""
    u = url.lower()
    if EXT_IMAGE.search(u): return "images"
    if EXT_PDF.search(u): return "pdf"
    if EXT_DOC.search(u): return "docs"
    if EXT_MEDIA.search(u): return "media"
    if u.endswith(".css") or "/.css?" in u or re.search(r"\.css(\?|$)", u): return "css"
    if u.endswith(".js") or re.search(r"\.js(\?|$)", u): return "js"
    if u.endswith(".svg") or ".svg?" in u: return "images"
    return None

def candidate_urls(url):
    """Given an asset url, yield the url itself and if it has a -WxH suffix, the stripped original."""
    yield url
    m = IMG_SIZE_SUFFIX.search(url)
    if m:
        base = url[:m.start()]
        ext = m.group(3)
        yield base + ext

def unique_path(directory, url):
    """Pick a filename in directory for url; add short hash if the same name is already used by another URL."""
    name = os.path.basename(urllib.parse.urlsplit(url).path) or "asset"
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    target = os.path.join(directory, name)
    if not os.path.exists(target):
        return target
    # name collision: only add hash if the existing file came from a different URL
    h = hashlib.sha256(url.encode()).hexdigest()[:8]
    stem, ext = os.path.splitext(name)
    return os.path.join(directory, "%s.%s%s" % (stem, h, ext))

def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()

def download_asset(url, found_on, alt="", parsed_html=None):
    """Download an asset. Returns dict record or None on failure. Resume-safe: skip if already on disk."""
    kind = asset_kind(url)
    if kind is None:
        return None
    directory = ASSETS.get(kind) or RAW_ASSETS.get(kind)
    if directory is None:
        return None
    # prefer original (largest) variant
    urls_to_try = list(candidate_urls(url))
    chosen = urls_to_try[0]
    for u in urls_to_try:
        # if the -WxH variant has already been downloaded from a different URL, prefer the stripped one
        pass
    # If a "-WxH" variant exists, we actually want the stripped original if it looks larger
    if len(urls_to_try) > 1:
        # check: does the stripped version exist on disk? if so, use it
        stripped = urls_to_try[-1]
        name_stripped = os.path.basename(urllib.parse.urlsplit(stripped).path)
        if os.path.exists(os.path.join(directory, name_stripped)):
            chosen = stripped
        else:
            chosen = urls_to_try[0]
    target = unique_path(directory, chosen)
    if os.path.exists(target) and os.path.getsize(target) > 0:
        # resume-safe: assume ok
        rec = {
            "url": chosen, "requested_url": url, "local_path": target,
            "bytes": os.path.getsize(target),
            "sha256": sha256_file(target),
            "content_type": "",
            "found_on": [found_on], "alt": alt,
            "kind": kind, "image_size": None,
        }
        if kind == "images":
            rec["image_size"] = list(read_image_size(target) or []) or None
        return rec
    s, final_url, body, ct = http_get(chosen)
    if isinstance(s, int) and s == 200 and body:
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "wb") as f:
            f.write(body)
        rec = {
            "url": chosen, "requested_url": url, "local_path": target,
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "content_type": ct,
            "found_on": [found_on], "alt": alt,
            "kind": kind, "image_size": None,
        }
        if kind == "images":
            sz = read_image_size(target)
            rec["image_size"] = list(sz) if sz else None
        return rec
    else:
        log("  [asset miss] %s -> %s" % (chosen, s))
        return {"url": chosen, "requested_url": url, "local_path": None, "bytes": 0,
                "sha256": "", "content_type": ct, "found_on": [found_on], "alt": alt,
                "kind": kind, "image_size": None, "error": str(s)}

# ---------------- Main crawl ----------------
def slug_from_url(url):
    p = urllib.parse.urlsplit(url)
    path = urllib.parse.unquote(p.path)
    q = urllib.parse.parse_qs(p.query)
    qpart = ""
    if "p" in q: qpart = "p" + q["p"][0]
    elif "page_id" in q: qpart = "page_id" + q["page_id"][0]
    elif "attachment" in q: qpart = "att" + q["attachment"][0]
    elif "paged" in q: qpart = "paged" + q["paged"][0]
    else:
        # keep any real-looking query
        for k in ("s","cat","tag"):
            if k in q: qpart = k + q[k][0]; break
    name = path.strip("/").replace("/", "__") or "home"
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", name)[:120]
    if qpart:
        name += "_" + re.sub(r"[^A-Za-z0-9_.-]","_",qpart)
    return name + ".html"

def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default

def save_json(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def main():
    log("=== SDCA crawl start ===")
    pages_file = os.path.join(DATA, "pages.jsonl")
    external_file = os.path.join(DATA, "external_links.json")
    assets_file = os.path.join(DATA, "assets.json")
    broken_file = os.path.join(DATA, "broken_links.json")

    # resume-safe: load existing
    seen_pages = set()
    if os.path.exists(pages_file):
        with open(pages_file, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    seen_pages.add(r["url"])
                except Exception:
                    pass
    external = load_json(external_file, [])
    external_seen = {(e["url"], e.get("found_on")) for e in external}
    assets = load_json(assets_file, [])
    asset_by_url = {a.get("url"): a for a in assets}
    # also record found_on for existing assets so re-visits don't duplicate
    for a in assets:
        if isinstance(a.get("found_on"), list):
            for u in a["found_on"]:
                external_seen  # no-op
    status_counts = {}
    broken_links = []
    pages_crawled_this_run = 0

    queue = [START]
    visited = set()
    all_urls_seen = set()

    def note_external(url, anchor, found_on):
        key = (url, found_on)
        if key in external_seen:
            return
        ext = url
        p = urllib.parse.urlsplit(url)
        if not p.scheme: ext = url
        external.append({"url": ext, "anchor": anchor, "found_on": found_on})
        external_seen.add(key)

    def maybe_record_asset(img, found_on, parsed_html):
        url = (img.get("src") or "").strip()
        if not url: return
        if url.startswith("//"): url = "https:" + url
        elif url.startswith("/"): url = BASEURL + url
        elif not url.startswith("http"): return
        kind = asset_kind(url)
        if kind is None: return
        key = url
        # dedupe: if we already have an asset whose local_path exists and url matches, just add found_on
        existing = asset_by_url.get(key)
        if existing is None:
            for k, v in asset_by_url.items():
                if k.startswith(url): 
                    existing = v; break
        if existing is None:
            rec = download_asset(url, found_on, alt=img.get("alt",""), parsed_html=parsed_html)
            if rec:
                assets.append(rec)
                asset_by_url[rec["url"]] = rec
                asset_by_url[url] = rec
        else:
            if found_on not in existing.get("found_on", []):
                existing.setdefault("found_on", []).append(found_on)

    # seed: also add sitemap, feeds, robots, 404, wp-json root
    seed_urls = [
        "https://sandiegochineseschool.com/robots.txt",
        "https://sandiegochineseschool.com/wp-sitemap.xml",
        "https://sandiegochineseschool.com/sitemap.xml",
        "https://sandiegochineseschool.com/feed/",
        "https://sandiegochineseschool.com/comments/feed/",
        "https://sandiegochineseschool.com/wp-json/",
        "https://sandiegochineseschool.com/wp-json/wp/v2/pages?per_page=100",
        "https://sandiegochineseschool.com/wp-json/wp/v2/posts?per_page=100",
        "https://sandiegochineseschool.com/wp-json/wp/v2/media?per_page=100",
    ]
    # 404 probe (do not count as a real page / broken link)
    s404,_,_,_ = http_get("https://sandiegochineseschool.com/this-page-does-not-exist-xyz123")
    log("404 probe status: %s" % s404)
    with open(os.path.join(DATA, "probe_404_status.txt"), "w") as f:
        f.write(str(s404))
    extra_special = []
    def process_page(url):
        nonlocal pages_crawled_this_run
        if url in visited or url in seen_pages:
            return
        visited.add(url)
        if len(visited) > MAX_PAGES:
            log("MAX_PAGES reached; stopping page expansion")
            return
        pages_crawled_this_run += 1
        s, final_url, body, ct = http_get(url)
        status = s if isinstance(s, int) else 599
        status_counts[status] = status_counts.get(status, 0) + 1
        if not isinstance(s, int) or s >= 400:
            log("  [page %s] %s %s" % (status, url, (s if isinstance(s,int) else "ERR")))
            if 400 <= status < 600:
                broken_links.append({"url": url, "status": status, "final_url": final_url})
            # still record a stub
            rec = {"url": url, "status": status, "final_url": final_url, "title": None,
                   "meta_description": None, "lang": None, "outline": [],
                   "text_main": "", "text_nav": "", "text_footer": "",
                   "nav_menu": [], "internal_links": [], "external_links": [],
                   "images": [], "forms": [], "iframes": [], "scripts": [],
                   "plugins": [], "theme": None, "published_date": None, "modified_date": None,
                   "features": [], "html_file": None, "error": (str(s) if not isinstance(s,int) else None)}
            with open(pages_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            seen_pages.add(url)
            return
        # save raw html
        slug = slug_from_url(url)
        raw_path = os.path.join(RAW_PAGES, slug)
        html_text = body.decode("utf-8", "replace")
        with open(raw_path, "wb") as f:
            f.write(body)
        parsed = parse_html(html_text)
        # gather links
        internal_links = []
        external_links = []
        for l in parsed["links"]:
            href = (l.get("href") or "").strip()
            anchor = l.get("text") or ""
            if not href: continue
            if href.startswith(("mailto:","tel:","javascript:","data:")):
                if href.startswith("mailto:"):
                    external_links.append({"url": href, "anchor": anchor})
                continue
            if href.startswith("//"): href = "https:" + href
            canon = normalize(href, url)
            if canon is None:
                # external (or skip-list)
                sp = urllib.parse.urlsplit(href)
                if sp.scheme in ("http","https"):
                    external_links.append({"url": href, "anchor": anchor})
                    note_external(href, anchor, url)
                continue
            internal_links.append(canon)
            if canon not in visited and canon not in seen_pages:
                queue.append(canon)
        # images
        image_records = []
        for im in parsed["images"]:
            src = (im.get("src") or "").strip()
            if not src: continue
            if src.startswith("//"): src = "https:" + src
            elif src.startswith("/"): src = BASEURL + src
            if not src.startswith("http"): continue
            if not is_internal(src):
                external_links.append({"url": src, "anchor": im.get("alt","")})
                note_external(src, im.get("alt",""), url)
                continue
            image_records.append({"src": src, "alt": im.get("alt",""), "w": im.get("w"), "h": im.get("h")})
            maybe_record_asset(im, url, html_text)
        # nav menu (use text_nav as simple flat list; parse ul/li from html for tree)
        nav_menu = build_nav_menu(html_text)
        # dates
        mdate = re.search(r'<meta[^>]+property=["\']article:published_time["\'][^>]+content=["\']([^"\']+)["\']', html_text)
        mmod  = re.search(r'<meta[^>]+property=["\']article:modified_time["\'][^>]+content=["\']([^"\']+)["\']', html_text)
        mdate2 = re.search(r'content=["\']([^"\']+)["\'][^>]+property=["\']article:published_time["\']', html_text)
        published = mdate.group(1) if mdate else (mdate2.group(1) if mdate2 else None)
        modified  = mmod.group(1) if mmod else None
        # scripts & plugins & theme
        scripts = parsed["script_srcs"]
        plugins = parsed["plugins"]
        theme = parsed["theme"]
        features = detect_features(parsed, html_text)
        rec = {
            "url": url, "status": status, "final_url": final_url,
            "title": parsed["title"], "meta_description": parsed["meta_description"],
            "lang": parsed["lang"],
            "outline": parsed["outline"],
            "text_main": parsed["text_main"],
            "text_nav": parsed["text_nav"],
            "text_footer": parsed["text_footer"],
            "nav_menu": nav_menu,
            "internal_links": sorted(set(internal_links)),
            "external_links": external_links,
            "images": image_records,
            "forms": parsed["forms"],
            "iframes": parsed["iframes"],
            "scripts": scripts,
            "plugins": plugins,
            "theme": theme,
            "published_date": published,
            "modified_date": modified,
            "features": features,
            "html_file": "research/raw/pages/" + slug,
        }
        with open(pages_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        seen_pages.add(url)
        log("  [page %s] %s  (links=%d, imgs=%d, forms=%d, feats=%s)" % (
            status, url, len(internal_links), len(image_records), len(parsed["forms"]),
            ",".join(features[:6])))

    def build_nav_menu(html_text):
        """Flat list of {text, href} for links inside <nav> elements."""
        items = []
        for m in re.finditer(r"<nav[\s\S]*?</nav>", html_text):
            chunk = m.group(0)
            for a in re.finditer(r"<a\b([^>]*)>", chunk):
                tag = a.group(1)
                href = re.search(r'href=["\']([^"\']*)["\']', tag)
                txt = re.search(r">([^<]*)</a>", chunk[a.end():a.end()+200])
                items.append({"text": (txt.group(1).strip() if txt else ""),
                              "href": href.group(1) if href else ""})
        # de-dup
        seen=set(); out=[]
        for it in items:
            k=(it["text"],it["href"])
            if k in seen: continue
            seen.add(k); out.append(it)
        return out

    # Process seed URLs (special: sitemaps, feeds, robots, wp-json, 404)
    for u in seed_urls:
        log("SEED %s" % u)
        s, final, body, ct = http_get(u)
        status = s if isinstance(s,int) else 599
        # save raw under a special name
        key = u
        name = os.path.basename(urllib.parse.urlsplit(u).path) or "seed"
        name = re.sub(r"[^A-Za-z0-9._-]","_", name)
        # add per_page for api endpoints to distinguish pagination
        if "/wp-json/wp/v2/" in u:
            name = name.replace(".xml","") + ".json"
        special_path = os.path.join(RAW_PAGES, "seed_" + name)
        if isinstance(s,int) and s == 200 and body:
            with open(special_path, "wb") as f: f.write(body)
        log("  [seed %s] %s (%d bytes)" % (status, u, len(body) if isinstance(body, bytes) else 0))
        # Extract URLs from sitemap XML
        if u.endswith(".xml") and status == 200:
            txt = body.decode("utf-8","replace")
            for loc in re.findall(r"<loc>(.*?)</loc>", txt):
                canon = normalize(loc)
                if canon and canon not in seen_pages and canon not in visited:
                    queue.append(canon)
            # sitemap index: also fetch child sitemaps
            if "<sitemapindex" in txt:
                for loc in re.findall(r"<loc>(.*?)</loc>", txt):
                    if "/wp-sitemap-" in loc and not loc.endswith("index.xsl"):
                        log("  sub-sitemap: %s" % loc)
                        s2, f2, b2, c2 = http_get(loc)
                        if isinstance(s2,int) and s2 == 200 and b2:
                            sub_name = "seed_" + os.path.basename(urllib.parse.urlsplit(loc).path)
                            with open(os.path.join(RAW_PAGES, sub_name), "wb") as f: f.write(b2)
                            for l2 in re.findall(r"<loc>(.*?)</loc>", b2.decode("utf-8","replace")):
                                canon = normalize(l2)
                                if canon and canon not in seen_pages and canon not in visited:
                                    queue.append(canon)
        # For wp-json lists, extract link field URLs
        if "/wp-json/wp/v2/" in u and status == 200:
            try:
                data = json.loads(body.decode("utf-8","replace"))
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and "link" in item:
                            canon = normalize(item["link"])
                            if canon and canon not in seen_pages and canon not in visited:
                                queue.append(canon)
                        # also collect media source urls
                        if isinstance(item, dict) and item.get("media_type") == "image":
                            src = item.get("source_url")
                            if src:
                                note_external(src, "", u)  # skip, internal
                                im = {"src": src, "alt": item.get("alt_text","")}
                                if is_internal(src):
                                    maybe_record_asset(im, u, "")
            except Exception as e:
                log("  json parse error: %s" % e)
        # Feed: extract item links
        if u.endswith("/feed/") or "/feed" in u and u.endswith("feed/") or "/feed" in u:
            txt = body.decode("utf-8","replace") if body else ""
            for l in re.findall(r"<link>(.*?)</link>", txt):
                canon = normalize(l)
                if canon and canon not in seen_pages and canon not in visited:
                    queue.append(canon)

    # BFS crawl
    log("Queue seeded with %d URLs" % len(queue))
    processed = 0
    while queue and processed < MAX_PAGES:
        url = queue.pop(0)
        if url in visited or url in seen_pages:
            continue
        process_page(url)
        processed += 1

    # Save final JSON outputs
    save_json(external_file, external)
    save_json(assets_file, assets)
    save_json(broken_file, broken_links)

    # Summary
    img_mb = sum(a.get("bytes",0) for a in assets if a.get("kind")=="images")/(1024*1024)
    pdf_mb = sum(a.get("bytes",0) for a in assets if a.get("kind")=="pdf")/(1024*1024)
    doc_mb = sum(a.get("bytes",0) for a in assets if a.get("kind")=="docs")/(1024*1024)
    media_mb = sum(a.get("bytes",0) for a in assets if a.get("kind")=="media")/(1024*1024)
    n_images = sum(1 for a in assets if a.get("kind")=="images")
    n_pdfs = sum(1 for a in assets if a.get("kind")=="pdf")
    n_docs = sum(1 for a in assets if a.get("kind")=="docs")
    n_media = sum(1 for a in assets if a.get("kind")=="media")
    print()
    print("="*60)
    print("SDCA CRAWL SUMMARY")
    print("="*60)
    print("Pages crawled (this run):", pages_crawled_this_run)
    print("Status codes:", dict(sorted(status_counts.items())))
    print("Total pages in pages.jsonl:", len(seen_pages))
    print("Images downloaded: %d  (%.2f MB)" % (n_images, img_mb))
    print("PDFs downloaded:    %d  (%.2f MB)" % (n_pdfs, pdf_mb))
    print("Docs downloaded:    %d  (%.2f MB)" % (n_docs, doc_mb))
    print("Media downloaded:   %d  (%.2f MB)" % (n_media, media_mb))
    print("External links:     %d" % len(external))
    print("Broken links (4xx/5xx): %d" % len(broken_links))
    print("="*60)
    log("=== SDCA crawl done ===")

if __name__ == "__main__":
    main()

