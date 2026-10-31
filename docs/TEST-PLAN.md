# Manual Real-Browser Test Plan

Verification matrix across Chrome Stable and Edge Stable (loaded via `chrome://extensions` and `edge://extensions` with **Load unpacked**):

| Platform / Surface | Input Field Type | Status | Verified By | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Gmail Compose | Rich Contenteditable | NOT VERIFIED | - | Scheduled for M2/M4 |
| Outlook Web | Rich Contenteditable | NOT VERIFIED | - | Scheduled for M2/M4 |
| WhatsApp Web | Chat Textarea / Div | NOT VERIFIED | - | Scheduled for M2/M4 |
| Slack | Rich Quill / Draft Input | NOT VERIFIED | - | Scheduled for M2/M4 |
| X (Twitter) | Draft.js Contenteditable | NOT VERIFIED | - | Scheduled for M2/M4 |
| LinkedIn Post | Rich Contenteditable | NOT VERIFIED | - | Scheduled for M2/M4 |
| Reddit Comment | Textarea & Rich Editor | NOT VERIFIED | - | Scheduled for M2/M4 |
| GitHub Comments | Standard Textarea | NOT VERIFIED | - | Scheduled for M2/M4 |
| Notion | Custom Contenteditable | NOT VERIFIED | - | Scheduled for M2/M4 |

## Local Automated Fixtures (Playwright)
- [x] Input (`<input type="text">`)
- [x] Textarea (`<textarea>`)
- [x] Contenteditable (`<div contenteditable="true">`)
- [x] Plaintext-only contenteditable
- [x] React-controlled input
- [x] Embedded `<iframe>`
- [x] Open Shadow DOM input
