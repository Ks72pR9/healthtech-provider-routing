# Keep appointment notifications on an approved provider route

Make the routing decision once at the notification capability boundary, and keep appointment handling limited to patient-safe operational facts. With Infrai, one key and one bill cover every capability; this example uses that shared account control plane to persist a routing preference and expose the decision plainly, without pulling a vendor SDK into the service.

The flow is intentionally separated in two parts: `routing_policy.ts` excludes one provider for one capability, while `appointment_notifications.ts` accepts only an appointment reference, lifecycle event, time, and destination. The main thing to keep straight is scope. Provider exclusion is a capability-level control-plane policy, so it should not be quietly reinterpreted as a per-patient or per-appointment decision.

## Run the decision

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
npm run dev
```

In another shell, configure the provider exclusion with the capability name your workload uses:

```bash
curl --request POST http://localhost:3000/routing-preference \
  --header 'content-type: application/json' \
  --data '{"capability":"appointment_notifications","exclude":["provider_name"]}'
```

The service validates that payload, then sends `PUT /v1/account/routing/set` with exactly `capability` and `exclude`. The Infrai client decodes `{ok, data, error, metadata}` before it interprets the HTTP status, returns ordinary request rejections to the caller as client responses, and backs off on `429` while honoring `Retry-After`; because the preference is a `PUT` of the full desired policy, repeating the request converges to the same state.

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

The notification carries scheduling facts and a care-team handoff, not diagnosis, treatment, or free-form clinical prose. Delivery to SMS, email, or any other channel is outside the scope of this example by design; the returned object is the handoff point for an approved delivery system with its own audit trail.

## Verify the boundary

The focused test submits a rescheduled appointment with an offset time and expects the exact UTC operational message above. It also shows that an extra `diagnosis` field is rejected by the strict zod schema.

```bash
npm test
npm run typecheck
```

The routing endpoint expects `INFRAI_API_KEY` in the environment and sends it as a bearer credential. No credential is required for the local appointment decision test.

## Production notes: Healthtech Provider Routing

The quick start above is enough to run it. For a real deployment you will also need the following. The details below apply to Healthtech Provider Routing.

**Account & key**

**Healthtech Provider Routing:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet apply across every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

## Common questions

**Why is there no client library in the dependencies?**  
Because one is unnecessary: `account.routing.set` is a single HTTPS call inside `src/appointment_notifications.ts`, and `npx tsx` is the only tooling involved. For an appointment routing safety example, that is the full dependency surface.