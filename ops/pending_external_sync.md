# Pending external sync

Status: **PENDING**. No callable Google Sheets/Drive integration or designated spreadsheet/folder was available at bootstrap. Environment-variable-name inspection found no GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SHEET_ID, or GOOGLE_DRIVE_FOLDER_ID; credential values and browser stores were not accessed. This is not proof that the operator has no Google account or credentials elsewhere.

The append-only [local execution log](AI_Execution_Log.csv) is the durable source. Every row with `sync_status=pending` is queued by event_id. No Google synchronization is claimed. No custom plugin schema was downloaded.

To enable sync, the operator must provide an approved existing connection and designated sheet/folder access. A service account is one possible method, not a requirement; do not create credentials, connect accounts, expand scopes, or change IAM automatically. Keep destination configuration and authentication outside this public repository.

When access exists: reconcile event_id before retrying uncertain appends, append sanitized rows to AI_Execution_Log using RAW cell input, verify the returned updated range, and record a receipt without rewriting historical rows. Store only reviewed non-secret custom schemas in the approved Drive folder; verify hash, version, and permissions. Never upload participant content, source logs, or credential-bearing configuration. Unknown acknowledgement remains pending until reconciled.
