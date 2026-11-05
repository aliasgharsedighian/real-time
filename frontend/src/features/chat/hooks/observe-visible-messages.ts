// Observe rendered bubbles, not the whole downloaded history. Loading a page or
// receiving a message while scrolled up must not mark offscreen messages seen.
export function observeVisibleMessages(
  root: HTMLElement | null,
  onChange: () => void,
) {
  const visible = new Set<number>();
  const observed = new Set<Element>();
  const observer =
    root && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const id = Number(entry.target.getAttribute("data-message-id"));
              if (entry.isIntersecting && root.contains(entry.target))
                visible.add(id);
              else visible.delete(id);
            }
            onChange();
          },
          { root, threshold: 0 },
        )
      : undefined;
  const refresh = () => {
    if (!root || !observer) return;
    for (const element of observed)
      if (!root.contains(element)) {
        observer.unobserve(element);
        observed.delete(element);
        visible.delete(Number(element.getAttribute("data-message-id")));
      }
    for (const element of root.querySelectorAll("[data-message-id]"))
      if (!observed.has(element)) {
        observed.add(element);
        observer.observe(element);
      }
  };
  const mutations =
    root && observer ? new MutationObserver(refresh) : undefined;
  mutations?.observe(root!, { childList: true, subtree: true });
  refresh();
  return {
    ids: visible,
    stop: () => {
      mutations?.disconnect();
      observer?.disconnect();
    },
  };
}
