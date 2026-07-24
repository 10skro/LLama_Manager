## Changes

### Fixes
- Fix model_folder setting not persisting to database — add debounced auto-save on input change
- Fix font_family and model_folder not loading on app startup — include all AppSettings fields in merged object
- Fix toggle_favorite_build missing required architecture parameter from frontend
- Add architecture field to FavoriteBuild interface for backend compatibility
