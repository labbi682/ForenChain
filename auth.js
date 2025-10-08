// DOM Elements
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginTab = document.getElementById("login-tab");
const signupTab = document.getElementById("signup-tab");
const authMessage = document.getElementById("auth-message");

// Toggle forms
loginTab.addEventListener("click", () => {
    loginForm.classList.remove("hidden");
    signupForm.classList.add("hidden");
    loginTab.classList.add("active-tab");
    signupTab.classList.remove("active-tab");
});

signupTab.addEventListener("click", () => {
    signupForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
    signupTab.classList.add("active-tab");
    loginTab.classList.remove("active-tab");
});

// Signup
signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    const caseId = document.getElementById("signup-caseid").value;
    const role = document.getElementById("signup-role").value;

    let users = JSON.parse(localStorage.getItem("users")) || [];
    if(users.some(u => u.username === username)) {
        authMessage.textContent = "Username already exists!";
        return;
    }

    users.push({username, password, caseId, role});
    localStorage.setItem("users", JSON.stringify(users));
    authMessage.textContent = "Sign Up Successful! Please login.";
    signupForm.reset();
    loginTab.click();
});

// Login
loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const caseId = document.getElementById("login-caseid").value;
    const role = document.getElementById("login-role").value;

    const users = JSON.parse(localStorage.getItem("users")) || [];
    const user = users.find(u => u.username === username && u.password === password && u.caseId === caseId && u.role === role);

    if(user) {
        localStorage.setItem("loggedInUser", JSON.stringify(user));
        window.location.href = "dashboard.html";
    } else {
        authMessage.textContent = "Invalid credentials, case ID, or role!";
    }
});
