const KEY = "samsparkling-demo-content-v1";
if (new URLSearchParams(location.search).get("resetDemo") === "1") {
  localStorage.removeItem(KEY);
  localStorage.removeItem("samsparkling-demo-meta-v1");
  location.replace(location.pathname + location.hash);
}
