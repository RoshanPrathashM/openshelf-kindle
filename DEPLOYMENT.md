# Publish OpenShelf

OpenShelf is a plain HTML/CSS/JavaScript website, so the simplest deployment is directly from the `main` branch. No build action or workflow is required.

## One-time GitHub setup

1. Open [OpenShelf repository](https://github.com/RoshanPrathashM/openshelf-kindle).
2. Select **Settings → Pages**.
3. Under **Build and deployment → Source**, select **Deploy from a branch** (not GitHub Actions).
4. Under **Branch**, select `main`.
5. Under the folder dropdown, select `/(root)`.
6. Click **Save**.
7. Wait for the deployment status to appear. Under **Settings → Pages**, use **Visit site** when GitHub provides the link. The expected address is `https://roshanprathashm.github.io/openshelf-kindle/`.

The root directory contains `index.html`, so it is a valid static-site entry point.

## If it still does not publish

- Confirm the repository is public and the default branch is `main`.
- Confirm the source is **Deploy from a branch**, the branch is `main`, and the folder is `/(root)`; click **Save**.
- Open the repository's **Actions** tab to inspect the Pages build, if one is shown.
- Check **Settings → Pages** for an error or a **Visit site** link.
- GitHub says initial publication or updates can take several minutes. Avoid repeatedly changing settings while a deployment is running.

## Why no workflow?

This project doesn't have a build step. Branch-based GitHub Pages is simpler and avoids needing a custom deployment workflow. The former workflow file was removed because Pages was not enabled yet and the deployment action was failing at the setup stage.

GitHub Pages is static hosting. It cannot accept book uploads or provide secure server-side moderation on its own. See `README.md` for the future architecture.
