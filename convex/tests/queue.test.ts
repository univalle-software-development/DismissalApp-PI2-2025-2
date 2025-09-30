
import { ConvexError } from "convex/values";
import { expect, test, describe, beforeEach } from "vitest";
import { createConvexTest, testUserIdentity } from "../test";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const superAdminIdentity = {
  ...testUserIdentity,
  publicMetadata: {
    dismissalRole: "superadmin",
  },
};

// Test suite for dismissal queue-related Convex functions.
describe("queue", () => {
  let t: any;
  let studentId: Id<"students">;
  let campusId: Id<"campusSettings">;

  // Before each test, create an authenticated test context, a campus, and a student.
  beforeEach(async () => {
    t = await createConvexTest(superAdminIdentity);
    campusId = await t.mutation(api.campus.create, {
      campusName: "Main Campus",
      displayName: "Main Campus",
      timezone: "America/New_York",
    });
    studentId = await t.mutation(api.students.create, {
      firstName: "John",
      lastName: "Doe",
      birthday: "2010-01-01",
      grade: "1st",
      campusLocation: "Main Campus",
      carNumber: 123,
    });
  });

  // Test case: Ensures a car can be successfully added to the dismissal queue.
  test("should add a car to the queue", async () => {
    const result = await t.mutation(api.queue.addCar, {
      carNumber: 123,
      campus: "Main Campus",
      lane: "left",
    });
    expect(result.success).toBe(true);
    const queue = await t.query(api.queue.getCurrentQueue, {
      campus: "Main Campus",
    });
    expect(queue.totalCars).toBe(1);
  });

  // Test case: Verifies that a car can be removed from the dismissal queue.
  test("should remove a car from the queue", async () => {
    const result = await t.mutation(api.queue.addCar, {
      carNumber: 123,
      campus: "Main Campus",
      lane: "left",
    });
    expect(result.success).toBe(true);
    await t.mutation(api.queue.removeCar, { queueId: result.queueId });
    const queue = await t.query(api.queue.getCurrentQueue, {
      campus: "Main Campus",
    });
    expect(queue.totalCars).toBe(0);
  });

  // Test case: Checks if a car can be moved from one lane to another within the queue.
  test("should move a car to a different lane", async () => {
    const result = await t.mutation(api.queue.addCar, {
      carNumber: 123,
      campus: "Main Campus",
      lane: "left",
    });
    expect(result.success).toBe(true);
    await t.mutation(api.queue.moveCar, {
      queueId: result.queueId,
      newLane: "right",
    });
    const queue = await t.query(api.queue.getCurrentQueue, {
      campus: "Main Campus",
    });
    expect(queue.leftLane.length).toBe(0);
    expect(queue.rightLane.length).toBe(1);
  });

  // Test case: Ensures that the current state of the dismissal queue can be retrieved.
  test("should get the current queue", async () => {
    await t.mutation(api.queue.addCar, {
      carNumber: 123,
      campus: "Main Campus",
      lane: "left",
    });
    const queue = await t.query(api.queue.getCurrentQueue, {
      campus: "Main Campus",
    });
    expect(queue.totalCars).toBe(1);
  });
});
