export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      appId: process.env.FIREBASE_APP_ID || "",
    },
  });
}
