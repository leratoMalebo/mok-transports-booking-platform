document.getElementById("registerForm")?.addEventListener("submit", e => {
  e.preventDefault();
  M.toast({ html: "Registration successful" });
  window.location.href = "login.html";
});

document.getElementById("loginForm")?.addEventListener("submit", e => {
  e.preventDefault();
  window.location.href = "dashboard.html";
});
