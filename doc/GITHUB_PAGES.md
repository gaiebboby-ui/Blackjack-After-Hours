# GitHub Pages and repository settings

The source repository remains private. README intentionally shows a placeholder until a web deployment exists.

## Current restrictions

GitHub Pages from a private personal repository requires GitHub Pro or another eligible paid plan. The current GitHub API also rejects ruleset and branch-protection configuration with an upgrade-required response. These are account restrictions; workflow changes cannot remove them. Do not make the source public or purchase a subscription automatically to bypass them.

Until branch protection is available, use pull requests and check the web and Android Checks jobs before merging. This is a working convention, not enforced protection. After a plan upgrade, require both checks, disallow force pushes and deletion, and apply protection to administrators where appropriate.

## Enable Pages when ready

1. Confirm that the plan supports Pages for this private repository and decide whether the resulting site may be public.
2. Select GitHub Actions as the Pages build source.
3. Set repository variable ENABLE_PRIVATE_PAGES=true only when publication is intended.
4. Allow tags v* and main in the github-pages environment.
5. Publish a stable release or manually run the Pages workflow for an existing stable tag.
6. Verify version.json and gameplay, then replace the README placeholder with the actual deployment URL.

The Pages workflow builds the exact release tag, includes licenses and uses the base path supplied by configure-pages. Draft and prerelease releases do not deploy. No personal access token or signing key is needed.

Official reference: [GitHub Pages availability](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
