# Live2D Runtime Assets

`models/` contains only models selected for the frontend. Each model must have a stable ID in
`data/live2dModels.json`; pet profiles reference that ID instead of a file path.

`runtime/cubism4/` contains the local Cubism 4 Core runtime used by the frontend. The runtime is
loaded from local assets and must remain subject to Live2D's licensing terms.

The manager syncs only `models/` and `runtime/` to `XHBlogs/public/live2d/`. Large source models
that are not ready for deployment belong in `D:\7.16\references\live2d-model-library`, where
they do not affect local preview, production builds, or Vercel uploads.

To add a model:

1. Validate its usage rights and Cubism 4 `.model3.json` bundle.
2. Place one self-contained bundle in `assets/live2d/models/<model-id>/`.
3. Add its entry URL, parameter ranges, presets, and layout to `data/live2dModels.json`.
4. Select the `model-id` for a pet in the manager, then run local sync.
