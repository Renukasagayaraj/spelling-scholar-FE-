# Welcome to your Lovable project

## End-to-end tests

Run the complete Playwright suite against the local frontend and backend:

```sh
npm run test:e2e
```

Run against the current Dev deployment URL produced by the deployment workflow:

```sh
BASE_URL=https://your-dev-deployment.example npm run test:e2e:dev
```

The Dev command requires `BASE_URL`. When it is set, Playwright connects directly
to that deployment without starting local web servers. When it is unset, the
default command uses the existing localhost setup.

TODO: Document your project here
