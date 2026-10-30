# GitHub Pages

The repository is public. The live game is hosted at [gaiebboby-ui.github.io/Blackjack-After-Hours](https://gaiebboby-ui.github.io/Blackjack-After-Hours/).

Pages uses GitHub Actions, and HTTPS is enforced. The first deployment uses release v1.0.1. Only the contents of dist/ are deployed; local archives, signing keys and source artwork are not part of the website.

## Publish an update

1. Push the tested release commit and a stable vX.Y.Z tag.
2. Publish the GitHub Release and mark it Latest.
3. The Pages workflow checks out that exact tag, runs the tests, builds with the configured project base path and deploys the result.
4. Verify version.json, the title screen, gameplay, music and mobile layout at the live URL.

Draft and prerelease releases do not deploy. The workflow can also be dispatched manually with an existing stable tag to redeploy or restore a release. The github-pages environment must allow the deployment's ref and tags v* if deployment branch restrictions are enabled.

No personal access token or Android signing key is used for Pages. The repository homepage and README point to the live site. The earlier plan restriction for Pages from a private repository no longer applies to this public repository.

Official reference: [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
