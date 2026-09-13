# Current User Workflow

No end-to-end workflow was observed during bootstrap. The baseline is **[HYPOTHESIS]** for interview validation; the product sequence is **[DECISION]** proposed behavior, not an implemented service.

## Baseline to investigate

Tenant notices a concern → contacts landlord/manager through an existing channel → clarifies symptoms → manager chooses a follow-up → handling occurs → parties communicate closure → records may be retained. Each transition, channel, pain point, delay, and exception remains **[TO VERIFY]**. Interviews must include successful existing workflows as well as failures.

## Proposed service sequence

1. Tenant begins a report; explain data use and allow minimal text input.
2. Check for urgent hazard signals immediately and after each new input. [Safety Gate](ai_safety_boundary.md) preempts ordinary troubleshooting.
3. Collect safe observations and optional permissioned media; ask only relevant clarifying questions.
4. Structure known information, show missing/uncertain fields, and obtain tenant confirmation.
5. Classify and suggest a next action within the safety boundary; route uncertainty to a human.
6. Create a task for the authorized landlord/manager and provide a receipt/status view.
7. Human manager assigns/follows up; record dated state changes without inventing work completion.
8. Record a human-confirmed outcome and allow reopen; retain permitted unit-level history.

## Failure and exception requirements

If media cannot be processed, say so and accept text; never infer visual findings. If a manager cannot be reached, disclose the delivery failure and show the approved human fallback. Duplicate reports should be linked after review, not silently discarded. An urgent report must not wait for media upload, complete fields, or ordinary triage. Handoff channels and response availability are **[TO VERIFY]** before a live pilot.
