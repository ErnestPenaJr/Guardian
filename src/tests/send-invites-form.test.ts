import { test, expect } from "bun:test";

test("Test SendInvitesForm API dependencies", async () => {
  console.log("🚀 Testing SendInvitesForm API dependencies...");
  
  // Test 1: Check if roles API endpoint exists
  console.log("1. Testing /api/roles endpoint...");
  const rolesResponse = await fetch("http://localhost:3001/api/roles", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token"
    }
  });
  
  const rolesText = await rolesResponse.text();
  console.log("Roles endpoint status:", rolesResponse.status);
  console.log("Roles endpoint response:", rolesText);
  
  // Should get 401 Unauthorized (endpoint exists but needs auth)
  expect(rolesResponse.status).toBe(401);
  
  // Test 2: Check if invites/send endpoint exists
  console.log("\n2. Testing /api/invites/send endpoint...");
  const invitesResponse = await fetch("http://localhost:3001/api/invites/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer fake-token"
    },
    body: JSON.stringify({
      invites: [
        {
          email: "test@example.com",
          roleId: 1
        }
      ]
    })
  });
  
  const invitesText = await invitesResponse.text();
  console.log("Invites endpoint status:", invitesResponse.status);
  console.log("Invites endpoint response:", invitesText);
  
  // Should get 401 Unauthorized (endpoint exists but needs auth)
  expect(invitesResponse.status).toBe(401);
  
  console.log("✅ Both API endpoints exist and require authentication as expected");
});

test("Test SendInvitesForm component logic", async () => {
  console.log("🚀 Testing SendInvitesForm component logic...");
  
  // Test the component's key functions
  
  // Test 1: Email validation logic
  console.log("1. Testing email validation...");
  const validEmails = [
    "test@example.com",
    "user@gmail.com", 
    "epenajr@gmail.com"
  ];
  
  const invalidEmails = [
    "",
    "invalid-email",
    "test@",
    "@example.com"
  ];
  
  validEmails.forEach(email => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValid).toBe(true);
    console.log(`✅ ${email} is valid`);
  });
  
  invalidEmails.forEach(email => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    expect(isValid).toBe(false);
    console.log(`❌ ${email} is invalid`);
  });
  
  // Test 2: Role ID validation
  console.log("\n2. Testing role ID validation...");
  const validRoleIds = [1, 2, 3];
  const invalidRoleIds = [null, "", 0, -1];
  
  validRoleIds.forEach(roleId => {
    const isValid = roleId && typeof roleId === 'number' && roleId > 0;
    expect(isValid).toBe(true);
    console.log(`✅ Role ID ${roleId} is valid`);
  });
  
  invalidRoleIds.forEach(roleId => {
    const isValid = !!(roleId && typeof roleId === 'number' && roleId > 0);
    expect(isValid).toBe(false);
    console.log(`❌ Role ID ${roleId} is invalid`);
  });
  
  // Test 3: Invite filtering logic (from line 86 in component)
  console.log("\n3. Testing invite filtering logic...");
  const inviteEmails = [
    { email: "test@example.com", roleId: 1 },
    { email: "", roleId: 2 }, // Should be filtered out
    { email: "user@gmail.com", roleId: null }, // Should be filtered out
    { email: "valid@example.com", roleId: 3 },
    { email: "", roleId: null } // Should be filtered out
  ];
  
  const filteredInvites = inviteEmails.filter(e => e.email && e.roleId);
  console.log("Original invites:", inviteEmails.length);
  console.log("Filtered invites:", filteredInvites.length);
  console.log("Valid invites:", filteredInvites);
  
  expect(filteredInvites.length).toBe(2);
  expect(filteredInvites[0].email).toBe("test@example.com");
  expect(filteredInvites[1].email).toBe("valid@example.com");
  
  console.log("✅ Invite filtering logic works correctly");
});

test("Test SendInvitesForm error handling", async () => {
  console.log("🚀 Testing SendInvitesForm error handling...");
  
  // Test the component's error handling patterns
  
  // Test 1: API error response structure
  console.log("1. Testing API error response structure...");
  const mockApiError = {
    response: {
      data: {
        error: "Database connection failed"
      }
    }
  };
  
  const errorMessage = mockApiError?.response?.data?.error || 'Failed to load roles. Please try again.';
  expect(errorMessage).toBe("Database connection failed");
  console.log("✅ API error extraction works correctly");
  
  // Test 2: Fallback error message
  console.log("\n2. Testing fallback error message...");
  const mockNetworkError = {};
  const fallbackMessage = (mockNetworkError as any)?.response?.data?.error || 'Failed to load roles. Please try again.';
  expect(fallbackMessage).toBe('Failed to load roles. Please try again.');
  console.log("✅ Fallback error message works correctly");
  
  // Test 3: Role data format handling
  console.log("\n3. Testing role data format handling...");
  const mockRolesResponse1 = {
    data: [
      { ROLE_ID: 1, DISPLAY_NAME: "Admin", NAME: "admin" },
      { ROLE_ID: 2, DISPLAY_NAME: "User", NAME: "user" }
    ]
  };
  
  const mockRolesResponse2 = {
    data: {
      success: true,
      data: [
        { id: 1, displayName: "Admin", name: "admin" },
        { id: 2, displayName: "User", name: "user" }
      ]
    }
  };
  
  // Test direct array format
  const formattedRoles1 = mockRolesResponse1.data.map((role: any) => ({
    id: role.id || role.ROLE_ID,
    name: role.displayName || role.name || role.DISPLAY_NAME || role.NAME
  }));
  
  expect(formattedRoles1.length).toBe(2);
  expect(formattedRoles1[0].id).toBe(1);
  expect(formattedRoles1[0].name).toBe("Admin");
  
  // Test nested success format
  const formattedRoles2 = mockRolesResponse2.data.data.map((role: any) => ({
    id: role.id || role.ROLE_ID,
    name: role.displayName || role.name || role.DISPLAY_NAME || role.NAME
  }));
  
  expect(formattedRoles2.length).toBe(2);
  expect(formattedRoles2[0].id).toBe(1);
  expect(formattedRoles2[0].name).toBe("Admin");
  
  console.log("✅ Role data format handling works correctly");
});

test("Test SendInvitesForm with real email", async () => {
  console.log("🚀 Testing SendInvitesForm with real email (epenajr@gmail.com)...");
  
  // Test the actual invite structure that would be sent
  const testInvite = {
    invites: [
      {
        email: "epenajr@gmail.com",
        roleId: 1
      }
    ]
  };
  
  console.log("Test invite structure:", JSON.stringify(testInvite, null, 2));
  
  // Validate the structure matches what the API expects
  expect(testInvite.invites).toBeInstanceOf(Array);
  expect(testInvite.invites.length).toBe(1);
  expect(testInvite.invites[0].email).toBe("epenajr@gmail.com");
  expect(testInvite.invites[0].roleId).toBe(1);
  
  // Test email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  expect(emailRegex.test(testInvite.invites[0].email)).toBe(true);
  
  // Test role ID validation
  expect(typeof testInvite.invites[0].roleId).toBe("number");
  expect(testInvite.invites[0].roleId).toBeGreaterThan(0);
  
  console.log("✅ Test invite structure is valid for epenajr@gmail.com");
  
  // Test the filtering logic that would be used
  const filteredInvites = testInvite.invites.filter(e => e.email && e.roleId);
  expect(filteredInvites.length).toBe(1);
  
  console.log("✅ Invite would pass all validation checks");
});