
import { ConvexError } from "convex/values";
import { expect, test, describe, beforeEach } from "vitest";
import { createConvexTest } from "../test";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Test suite for student-related Convex functions.
describe("students", () => {
  let t: any;
  let studentId: Id<"students">;

  // Before each test, create a new authenticated test context and a sample student.
  beforeEach(async () => {
    t = await createConvexTest();
    studentId = await t.mutation(api.students.create, {
      firstName: "John",
      lastName: "Doe",
      birthday: "2010-01-01",
      grade: "1st",
      campusLocation: "Main Campus",
      carNumber: 123,
    });
  });

  // Test case: Ensures a student can be successfully created.
  test("should create a student", async () => {
    const student = await t.query(api.students.get, { id: studentId });
    expect(student).not.toBeNull();
    expect(student.student.firstName).toBe("John");
  });

  // Test case: Verifies that an existing student can be retrieved by their ID.
  test("should get a student", async () => {
    const student = await t.query(api.students.get, { id: studentId });
    expect(student).not.toBeNull();
    expect(student.student.firstName).toBe("John");
  });

  // Test case: Checks if a student's information can be updated.
  test("should update a student", async () => {
    await t.mutation(api.students.update, {
      studentId,
      firstName: "Jane",
    });
    const student = await t.query(api.students.get, { id: studentId });
    expect(student.student.firstName).toBe("Jane");
  });

  // Test case: Ensures a student can be successfully deleted.
  test("should delete a student", async () => {
    await t.mutation(api.students.deleteStudent, { studentId });
    const student = await t.query(api.students.get, { id: studentId });
    expect(student).toBeNull();
  });

  // Test case: Verifies that a car number can be assigned to a student.
  test("should assign a car number to a student", async () => {
    await t.mutation(api.students.assignCarNumber, {
      studentId,
      carNumber: 456,
    });
    const student = await t.query(api.students.get, { id: studentId });
    expect(student.student.carNumber).toBe(456);
  });

  // Test case: Checks if a car number can be removed from a student.
  test("should remove a car number from a student", async () => {
    await t.mutation(api.students.removeCarNumber, { studentId });
    const student = await t.query(api.students.get, { id: studentId });
    expect(student.student.carNumber).toBe(0);
  });

  // Test case: Ensures that unauthenticated users cannot create a student.
  test("should not allow unauthenticated users to create a student", async () => {
    const t = await createConvexTest(null);
    await expect(
      t.mutation(api.students.create, {
        firstName: "John",
        lastName: "Doe",
        birthday: "2010-01-01",
        grade: "1st",
        campusLocation: "Main Campus",
        carNumber: 123,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
