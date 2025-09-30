
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

export const testUserIdentity = {
  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
  issuer: "https://clerk.dev",
  subject: "1234",
  name: "Test User",
  email: "test@example.com",
  pictureUrl: "https://test.com/picture.png",
  emailVerified: true,
  phoneNumber: "+1234567890",
  phoneNumberVerified: true,
  // Custom claims
  orgIds: ["org1"],
  orgRoles: { org1: "admin" },
  publicMetadata: {
    dismissalRole: "superadmin",
  },
  username: "testuser", // Added username
};

/**
 * Creates a ConvexTestingHelper with the given identity.
 *
 * @param identity The identity to use for the testing helper.
 * @returns A ConvexTestingHelper instance.
 */
export async function createConvexTest(identity: any = testUserIdentity) {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"));
  if (identity) {
    const authenticatedT = t.withIdentity(identity);
    // Insert a mock user into the database for authentication checks
    await authenticatedT.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: identity.subject,
        email: identity.email,
        username: identity.username, // Added username
        isActive: true,
        assignedCampuses: ["Main Campus"], // Default campus for tests
        createdAt: Date.now(), // Added createdAt
      });
    });
    return authenticatedT;
  }
  return t;
}
