type FirebaseConfig = {
  firebase: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    appId?: string;
  };
};

let configuration: Promise<FirebaseConfig> | undefined;

// Share the public runtime config across React's development remounts.
// A failed request can be retried on the next initialization.
export function loadFirebaseConfig(): Promise<FirebaseConfig> {
  if (!configuration) {
    configuration = fetch("/config")
      .then((response) => {
        if (!response.ok) throw new Error("Sign-in configuration is unavailable");
        return response.json() as Promise<FirebaseConfig>;
      })
      .catch((error) => {
        configuration = undefined;
        throw error;
      });
  }
  return configuration;
}
