# Credentials and secret scanning

Keep actual environment files, downloaded credentials, private keys and tokens outside version control. `.env.example` contains configuration names and empty credential values only. Keep backend credentials on the server; never put a service-account key or Google access token in browser code. Firebase browser configuration is supplied at runtime and is not a server credential; actual API-key values are not committed here.

GitHub secret scanning and push protection are enabled on the public repository. The public-release audit used checksum-verified Gitleaks 8.30.1 with redacted output. Repeat the full-history check locally before publishing changes:

```sh
gitleaks git . --log-opts="--all" --redact=100 --ignore-gitleaks-allow --no-banner
```

All default detectors remain enabled without exceptions. Do not add a baseline or broad ignore to hide a real credential.

Before public release on 19 October 2026, all tracked files and reachable history were scanned; no credentials were detected. An additional check of 325 historical text blobs found no Google API keys, Google access tokens, GitHub tokens or private keys. Synthetic credential detection and credential-file ignore rules were also checked. No Git history rewrite was required.

If a real credential is discovered later, revoke or rotate it first, then remove it from the files and reachable history. Report the location privately to the repository owner without posting the credential in an issue or log. Repository scanning does not audit credentials stored separately in developer machines, cloud services or external build logs.
