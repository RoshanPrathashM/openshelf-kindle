# Publish OpenShelf

## One-time GitHub setup

1. Open **Settings → Pages** in this repository.
2. Choose **GitHub Actions** as the build and deployment source.
3. Ensure Actions are enabled and the workflow is present at `.github/workflows/pages.yml`.
4. Push changes to `main`, or open the Actions tab and run the workflow manually.
5. Open the successful **Deploy OpenShelf to GitHub Pages** workflow. Its deployment environment should show the site URL; it normally resembles `https://RoshanPrathashM.github.io/openshelf-kindle/`.

## If deployment does not run

- Check the latest workflow run in the Actions tab.
- Check that Pages source is set to GitHub Actions under Settings → Pages.
- Check that the default branch is `main`, or update the workflow trigger.
- Review the workflow log for the exact error.

GitHub Pages is static hosting. It cannot accept book uploads or provide secure server-side moderation on its own. See `README.md` for the future architecture.
