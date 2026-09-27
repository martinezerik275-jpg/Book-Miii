/* ================= launcher: open any tile, count opens, favorites ================= */
function openItem(c, tile) {
  if (!c) return;
  if (c.kind === "stack") openStack(c, tile);
  else if (c.kind === "project") openProject(c, tile);
  else openPreview(c, tile);
}
// how often and how recently you open a site: private, so it never touches the shared menu
function noteOpen(c) {
  if (!c || visiting || c.kind) return;
  c.opens = (c.opens || 0) + 1; c.lastOpen = Date.now();
  savePrivateOnly(state);
}
function toggleFav(c) {
  if (!c || visiting) return;
  c.fav = !c.fav || undefined;
  persist(state); paintFav(c); sfx(c.fav ? "confirm" : "back");
  toast(c.fav ? c.name + " added to favorites" : c.name + " removed from favorites");
}
function paintFav(c) {
  const b = $("#pvFav");
  b.hidden = !!visiting || !c || c.kind === "flow";
  b.textContent = c && c.fav ? "★ Favorite" : "☆ Favorite";
  b.setAttribute("aria-pressed", !!(c && c.fav));
}
$("#pvFav").onclick = () => toggleFav(pvChannel);
addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !$("#start").classList.contains("open")) {
    e.preventDefault();
    if ($("#search").classList.contains("open")) { hide("#search"); return; }
    if (anyOverlay()) return;
    openSearch("launch");
  }
});
