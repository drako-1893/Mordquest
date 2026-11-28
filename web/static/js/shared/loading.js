const screen = document.querySelector("#page-loading");
const firstPaint = new Promise(resolve => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

let resolvePageLoading;
export const pageLoadingFinished = new Promise(resolve => { resolvePageLoading = resolve; });

export async function finishPageLoading(content) {
  const shownAt = await firstPaint;
  const remaining = 1000 - (performance.now() - shownAt);
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));

  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const fade = screen.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 360,
      easing: "ease-out",
      fill: "forwards",
    });
    await fade.finished.catch(() => {});
  }

  screen.remove();
  content.inert = false;
  resolvePageLoading();
}
