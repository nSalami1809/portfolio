// A thin teal bar across the top of the screen that fills as a long text is read. Pure CSS: the browser drives it from
// the page's own scroll (scroll-driven animation, see `.reading-progress` in globals.css) — no JavaScript, no scroll
// listener. Browsers that cannot do that simply do not show it.
export default function ReadingProgress() {
  return <div className="reading-progress" aria-hidden="true" />
}
