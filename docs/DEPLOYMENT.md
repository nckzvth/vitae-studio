# Deployment

The public site is deployed through `.github/workflows/deploy-pages.yml` whenever `main` changes. The workflow installs the lockfile reproducibly, checks formatting, lints, type-checks, runs unit tests, builds the static application with the `/vitae-studio` base path, and deploys the validated `out/` directory.

For a custom domain, add the domain's `CNAME` to `public/`, set `NEXT_PUBLIC_BASE_PATH` to an empty value in the build, and configure the domain in GitHub Pages settings.
