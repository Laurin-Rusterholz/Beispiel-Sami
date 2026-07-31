const params = new URLSearchParams(location.search);
if (params.get("resetDemo") === "1") {
  localStorage.removeItem("samsparkling-demo-content-v1");
  localStorage.removeItem("samsparkling-demo-meta-v1");
  params.delete("resetDemo");
  const query = params.toString();
  history.replaceState(null, "", location.pathname + (query ? `?${query}` : "") + location.hash);
}
