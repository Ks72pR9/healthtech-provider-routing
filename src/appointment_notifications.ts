import { z } from "zod";

export const appointmentEventSchema = z.object({
  appointment_id: z.string().min(1),
  event: z.enum(["scheduled", "rescheduled", "cancelled"]),
  starts_at: z.string().datetime({ offset: true }),
  patient_contact: z.string().min(3)
}).strict();

export type AppointmentEvent = z.infer<typeof appointmentEventSchema>;

export type OperationalNotification = {
  appointment_id: string;
  recipient: string;
  message: string;
};

const eventText: Record<AppointmentEvent["event"], string> = {
  scheduled: "is scheduled for",
  rescheduled: "was rescheduled to",
  cancelled: "was cancelled; its previous time was"
};

export function buildOperationalNotification(
  value: AppointmentEvent
): OperationalNotification {
  const event = appointmentEventSchema.parse(value);
  const when = new Date(event.starts_at).toISOString();

  return {
    appointment_id: event.appointment_id,
    recipient: event.patient_contact,
    message: `Appointment ${event.appointment_id} ${eventText[event.event]} ${when}. Contact the care team for help.`
  };
}
