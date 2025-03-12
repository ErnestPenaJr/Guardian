import React, { useState } from "react";
import "./App.css";

const GuardianLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const validateForm = () => {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordPattern = /^[a-zA-Z0-9$#!\-_]+$/;

        if (email === "" || password === "") {
            alert("Incorrect Credentials");
        } else if (!emailPattern.test(email) || !passwordPattern.test(password)) {
            alert("Invalid email or password. Password can only contain letters, numbers, and the special characters $, #, !, -, _");
        } else {
            alert("You need to complete the registration process. If you need assistance, reach out to your administrator.");
        }
    };

    return (
        <div className="login-container">
            <div className="container">
                <h1>
                    <img src="GuardianLogo.png" alt="Guardian Logo" className="logo" /> Guardian
                </h1>
                <input 
                    type="email" 
                    placeholder="Email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                />
                <p align="right"><a href="#" className="forgot-password">Forgot password?</a></p>
                <div className="button-container">
                    <button onClick={validateForm}>Sign In</button>
                    <button onClick={() => alert("New Account clicked!")}>New Account</button>
                </div>
            </div>
            <div className="footer">
                <img src="ShieldLyticsLogoOrbitronVerticalTeal.png" alt="ShieldLytics Logo" className="footer-logo" />
            </div>
        </div>
    );
};

export default GuardianLogin;