const screen = document.querySelector("#page-loading");

let resolvePageLoading;
export const pageLoadingFinished = new Promise(resolve => { resolvePageLoading = resolve; });

export function finishPageLoading(content) {
  screen.remove();
  content.inert = false;
  resolvePageLoading();
}
