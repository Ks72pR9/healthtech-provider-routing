import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentEventSchema,
  buildOperationalNotification
} from "../src/appointment_notifications.js";

test("turns a reschedule into a bounded operational notification", () => {
  const notification = buildOperationalNotification({
    appointment_id: "apt_1042",
    event: "rescheduled",
    starts_at: "2026-10-03T09:30:00+08:00",
    patient_contact: "+8613800000000"
  });

  assert.deepEqual(notification, {
    appointment_id: "apt_1042",
    recipient: "+8613800000000",
    message: "Appointment apt_1042 was rescheduled to 2026-10-03T01:30:00.000Z. Contact the care team for help."
  });
});

test("rejects clinical free text at the request boundary", () => {
  const result = appointmentEventSchema.safeParse({
    appointment_id: "apt_1042",
    event: "scheduled",
    starts_at: "2026-10-03T09:30:00+08:00",
    patient_contact: "+8613800000000",
    diagnosis: "private detail"
  });

  assert.equal(result.success, false);
});
