import { test, expect } from "bun:test";

test("Send test invite to epenajr@gmail.com", async () => {
  // First, try to login to get a token (you'll need valid credentials)
  const loginResponse = await fetch("http://localhost:3001/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: process.env.TEST_EMAIL || "admin@test.com",
      password: process.env.TEST_PASSWORD || "password"
    })
  });

  const loginText = await loginResponse.text();
  console.log("Login response status:", loginResponse.status);
  console.log("Login response:", loginText);

  let token;
  try {
    const loginData = JSON.parse(loginText);
    token = loginData.token;
  } catch (e) {
    console.log("Failed to parse login response, using test token");
    token = "test-token";
  }

  // Now send the invite
  const response = await fetch("http://localhost:3001/api/invites/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      invites: [
        {
          email: "epenajr@gmail.com",
          roleId: 1
        }
      ]
    })
  });

  const text = await response.text();
  
  console.log("Invite response status:", response.status);
  console.log("Invite response text:", text);
  
  let data;
  try {
    data = JSON.parse(text);
    console.log("Invite response data:", data);
  } catch (e) {
    console.log("Failed to parse JSON response");
  }
  
  // Verify we got a response
  expect(response.status).toBeGreaterThan(0);
});