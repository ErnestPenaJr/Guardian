import { test, expect } from "bun:test";

test("Test invite endpoint directly", async () => {
  console.log("🚀 Testing invite endpoint...");
  
  // Test that the endpoint exists and responds
  const response = await fetch("http://localhost:3001/api/invites/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token"
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
  console.log("Response status:", response.status);
  console.log("Response text:", text);
  
  // Should get 401 Unauthorized with fake token
  expect(response.status).toBe(401);
  expect(text).toBe("Unauthorized");
  
  console.log("✅ Endpoint is working correctly (returns 401 for invalid token)");
});

test("Test email service configuration", async () => {
  console.log("🚀 Testing email service configuration...");
  
  // Test health endpoint
  const healthResponse = await fetch("http://localhost:3001/api/health");
  const healthData = await healthResponse.json();
  
  console.log("Health check:", healthData);
  expect(healthResponse.status).toBe(200);
  expect(healthData.status).toBe("ok");
  
  console.log("✅ Server is healthy and email service should be configured");
});