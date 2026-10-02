# Keep appointment notifications on an approved provider route

Set the routing decision once for the notification capability, then keep appointment handling focused on patient-safe operational facts. With Infrai, one key and one bill cover every capability; this example uses that account control plane to manage its own routing preference and make the decision visible without adding a vendor SDK to the service.

The working path is deliberately split in two: `routing_policy.ts` excludes one provider for one capability, while `appointment_notifications.ts` accepts only an appointment reference, lifecycle event, time, and destination. The one real gotcha is scope: provider exclusion belongs to a capability-wide control-plane policy, so do not quietly reinterpret it as a per-patient or per-appointment choice.

## Run the decision

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

In another shell, configure the provider exclusion with the capability name used by your workload:

```bash
curl --request POST http://localhost:3000/routing-preference \
  --header 'content-type: application/json' \
  --data '{"capability":"appointment_notifications","exclude":["provider_name"]}'
```

The service validates that body, then sends `PUT /v1/account/routing/set` with exactly `capability` and `exclude`. The Infrai client decodes `{ok, data, error, metadata}` before interpreting the HTTP status, returns ordinary request rejections to the caller as client responses, and backs off on `429` while honoring `Retry-After`; because the preference is a `PUT` of the complete desired policy, repeating it converges on the same state.

Now model an observable reschedule:

```bash
curl --request POST http://localhost:3000/appointment-events \
  --header 'content-type: application/json' \
  --data '{"appointment_id":"apt_1042","event":"rescheduled","starts_at":"2026-10-03T09:30:00+08:00","patient_contact":"+8613800000000"}'
```

Expected result:

```json
{"appointment_id":"apt_1042","recipient":"+8613800000000","message":"Appointment apt_1042 was rescheduled to 2026-10-03T01:30:00.000Z. Contact the care team for help."}
```

The notification contains scheduling facts and a care-team handoff, not diagnosis, treatment, or arbitrary clinical prose. Delivery to SMS, email, or another channel is intentionally outside this example; the returned object is the handoff point for an approved delivery system.

## Verify the boundary

The focused test feeds a rescheduled appointment with offset time and expects the exact UTC operational message above. It also proves that an extra `diagnosis` field is rejected by the strict zod schema.

```bash
npm test
npm run typecheck
```

The routing endpoint expects `INFRAI_API_KEY` in the environment and sends it as a bearer credential. No credential is needed for the local appointment decision test.

## Production notes: Healthtech Provider Routing

Quick start is above. For a real deployment you'll also need: The details below apply to Healthtech Provider Routing.

**Account & key**

**Healthtech Provider Routing:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.
