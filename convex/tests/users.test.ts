
import { expect, test, describe } from "vitest";
import { createConvexTest, testUserIdentity } from "../test";
import { api } from "../_generated/api";

// Test suite for user-related Convex functions.
describe("users", () => {
  // Test case: Verifies that an authenticated user can retrieve their profile information.
  test("should get current user profile", async () => {
    const t = await createConvexTest();
    const profile = await t.query(api.users.getCurrentProfile);
    expect(profile).not.toBeNull();
    expect(profile!.email).toBe(testUserIdentity.email);
  });

  // Test case: Ensures that a null profile is returned when the user is not authenticated.
  test("should return null when user is not authenticated", async () => {
    const t = await createConvexTest(null);
    const profile = await t.query(api.users.getCurrentProfile);
    expect(profile).toBeNull();
  });
});
