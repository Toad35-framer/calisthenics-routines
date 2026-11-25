"""Construit docs/index.html : le modèle index.src.html avec les scripts intégrés."""
import pathlib
S = pathlib.Path(__file__).resolve().parent; A = S.parent / "docs"
parts = ["bibliotheque/bundle.js", "js/figure.js", "js/store.js", "js/player.js", "js/app.js"]
blocks = []
for f in parts:
    code = (A / f).read_text().replace("</script", "<\\/script")
    blocks.append(f"<script>/* --- {f} --- */\n{code}\n</script>")
html = (S / "index.src.html").read_text().replace("__SCRIPTS__", "\n".join(blocks))
(A / "index.html").write_text(html)
print("index.html", len(html))
