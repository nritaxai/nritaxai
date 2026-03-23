async function loadBanner() {
  try {
    const res = await fetch("http://localhost:3000/api/banner-updates");
    const data = await res.json();
    const ticker = document.getElementById("ticker");

    if (!ticker) return;

    if (!Array.isArray(data) || !data.length) {
      ticker.innerHTML = "No updates available";
      return;
    }

    ticker.innerHTML = data
      .filter((item) => item.active === true)
      .sort((a, b) => {
        const priorityDelta = Number(a.priority || 0) - Number(b.priority || 0);
        if (priorityDelta !== 0) return priorityDelta;
        return Date.parse(String(b.date || "")) - Date.parse(String(a.date || ""));
      })
      .map(
        (item) => `
          <a href="${item.url}">
            <span class="badge">${item.label || "UPDATE"}</span>
            ${item.date || ""} | ${item.country || ""} | ${item.title}
          </a>
        `
      )
      .join("");
  } catch (err) {
    console.error("Banner error:", err);
  }
}

loadBanner();
setInterval(loadBanner, 300000);
