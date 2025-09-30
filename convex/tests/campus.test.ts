
import { ConvexError } from "convex/values";
import { expect, test, describe } from "vitest";
import { createConvexTest, testUserIdentity } from "../test";
import { api } from "../_generated/api";

const superAdminIdentity = {
  ...testUserIdentity,
  publicMetadata: {
    dismissalRole: "superadmin",
  },
};

// Test suite for campus-related Convex functions.
describe("campus", () => {
  // Test case: Ensures a superadmin can successfully create a new campus.
  test("should create a campus", async () => {
    const t = await createConvexTest(superAdminIdentity);
    await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    const campus = await t.query(api.campus.get, { campusName: "Main Campus" });
    expect(campus).not.toBeNull();
    expect(campus!.displayName).toBe("Main Campus");
  });

  // Test case: Verifies that a superadmin can retrieve an existing campus.
  test("should get a campus", async () => {
    const t = await createConvexTest(superAdminIdentity);
    await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    const campus = await t.query(api.campus.get, { campusName: "Main Campus" });
    expect(campus).not.toBeNull();
    expect(campus!.displayName).toBe("Main Campus");
  });

  // Test case: Checks if a superadmin can update the details of an existing campus.
  test("should update a campus", async () => {
    const t = await createConvexTest(superAdminIdentity);
    await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    await t.mutation(api.campus.update, {
      campusName: "Main Campus",
      displayName: "New Main Campus",
    });
    const campus = await t.query(api.campus.get, { campusName: "Main Campus" });
    expect(campus).not.toBeNull();
    expect(campus!.displayName).toBe("New Main Campus");
  });

  // Test case: Confirms that a superadmin can retrieve a list of all active campuses.
  test("should list active campuses", async () => {
    const t = await createConvexTest(superAdminIdentity);
    await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    const campuses = await t.query(api.campus.listActive);
    expect(campuses.length).toBeGreaterThan(0);
  });

  // Test case: Verifies that a superadmin can retrieve statistics for a specific campus.
  test("should get campus stats", async () => {
    const t = await createConvexTest(superAdminIdentity);
    await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    const stats = await t.query(api.campus.getStats, { campus: "Main Campus" });
    expect(stats).not.toBeNull();
    expect(stats.totalStudents).toBe(0);
  });

  // Test case: Ensures that a non-superadmin user is prevented from creating a campus.
  test("should not allow non-superadmin to create a campus", async () => {
    const nonSuperAdminIdentity = {
      ...testUserIdentity,
      publicMetadata: {
        dismissalRole: "viewer",
      },
    };
    const t = await createConvexTest(nonSuperAdminIdentity);
    await expect(
      t.mutation(api.campus.create, {
        campusName: "Another Campus",
        displayName: "Another Campus",
        timezone: "America/New_York",
      })
    ).rejects.toThrow(
      new Error("Requires role: superadmin")
    );
  });
});
