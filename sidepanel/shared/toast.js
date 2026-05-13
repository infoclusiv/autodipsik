(function initToast(globalScope) {
  const NewSiteSidepanel = globalScope.NewSiteSidepanel = globalScope.NewSiteSidepanel || {};

  function ensureToastRegion() {
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      document.body.appendChild(region);
    }
    return region;
  }

  function showToast(message) {
    const region = ensureToastRegion();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    region.appendChild(toast);
    setTimeout(function removeToast() {
      toast.remove();
    }, 2600);
  }

  NewSiteSidepanel.Toast = {
    showToast: showToast
  };
})(globalThis);
