# Privacy-Safe File Transfers

Use this protocol before copying, exporting, attaching, or uploading project
files to another workspace, tool, service, or recipient. It validates scope; it
does not authorize a destination or perform a transfer.

1. Define the exact intended file set for this transfer. Prefer specific files;
   do not use a whole-directory request as an implicit scope.
2. Compare that set with an exact positive allowlist of approved paths. Transfer
   only files present in both sets. Unknown files and wildcard or extension-only
   approvals are excluded by default.
3. Classify each candidate from its contents and provenance. Raw client records,
   clinical or health records, credentials, and private keys are excluded unless
   a separate explicit decision authorizes that specific material and
   destination. A filename or extension cannot establish that a file is safe.
4. Check the destination, recipients, purpose, and minimum necessary content.
   Remove or transform sensitive content only when the resulting copy has been
   inspected and confirmed to retain no disallowed data.
5. Record the reviewed set and decision. Recheck the exact set if files or the
   destination change.

`scripts/check-transfer-allowlist.js` checks exact manifest paths against an
intended set and allowlist. It is a local, pure validation step: it does not
inspect file contents, grant authorization, or upload anything. A passing
result cannot approve sensitive material whose classification is unknown.
