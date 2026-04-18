# Security Specification for Sanscounts

## Data Invariants
1. A user can only access their own profile.
2. An email can only be read by its sender or recipient.
3. Users cannot modify the body or metadata of an existing email (immutable except for status flags).
4. Developer apps/domains can only be managed by the developer who created them.
5. Verification codes, OAuth codes, and tokens are system-protected; users cannot read them arbitrarily.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing (User)**: Create a user profile with a different UID than `request.auth.uid`.
2. **Privilege Escalation**: Set `role: 'admin'` in a user profile during creation/update.
3. **Email Interception**: Read an email where neither `senderEmail` nor `recipientEmail` matches the user's verified email.
4. **Forged Sender**: Send an email where `senderEmail` is another user's email.
5. **Content Poisoning**: Update the `body` of a sent email in another user's inbox.
6. **Shadow Update (Email)**: Inject a `systemNote` field into an email document.
7. **Resource Exhaustion**: Send an email with a 10MB body.
8. **App Hijacking**: Read/Modify `developer_apps` belonging to another user.
9. **OTP Harvest**: Read `verification_codes` for an email not belonging to the requester.
10. **Token Spoofing**: Write to `oauth_tokens` to grant themselves access.
11. **Status Shortcut**: Update a verification code's status from `pending` to `used` without the correct logic.
12. **Immutable Wipe**: Change the `createdAt` timestamp of a document.

## Test Runner (Draft)
A `firestore.rules.test.ts` will be implemented to verify these rejections.
