# Organization chart UI

The real project data screen renders the organization chart as a required
artifact. It uses the existing authenticated `/api` client and Vercel rewrite;
the browser never receives an S3 URL or AWS credentials.

## User flow

- PM: view the required item, generate or regenerate, preview, and download.
- STAFF: preview and download charts for projects where the user is an active
  member. Generate controls are not rendered.
- Missing chart: show `아직 생성되지 않음` and a PM-only generation action.
- Generating: disable duplicate submissions and display a spinner.
- Generated: show the authenticated JPG preview, version, generated time,
  approval status, and download action.

The preview endpoint is fetched as a `Blob` with the Bearer token. The component
creates a temporary object URL and revokes it when the project, image, or
component changes. Downloads use another short-lived object URL. Base64 image
data is not stored in React state or `localStorage`.

## API

```http
POST /api/projects/{projectId}/artifacts/organization-chart/generate
GET  /api/projects/{projectId}/artifacts/organization-chart/latest
GET  /api/projects/{projectId}/artifacts/organization-chart/latest/download
```

Specific prerequisite codes are translated into actionable messages for
missing confirmed WBS, schedules, active members, or member capabilities.
Authentication expiry continues through the shared refresh and logout flow.

Local verification:

```bash
npm ci
npm run build
npx playwright test tests/e2e/real-route.spec.ts
```

Figma mockups, Figma APIs, and Figma credentials are intentionally excluded.
