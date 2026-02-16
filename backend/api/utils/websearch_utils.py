from bs4 import BeautifulSoup


def _sanitize_blob(s: str, max_len: int = 1_000_000) -> str:
    # verwijder NUL-bytes en knip extreem lange payloads af
    return s.replace("\x00", "")[:max_len]


def _extract_main_text(html: str) -> str:
    try:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        # nette, compacte alinea's
        lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
        return "\n".join(lines)
    except Exception:
        return ""
