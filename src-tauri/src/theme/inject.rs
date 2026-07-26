use crate::theme::colors::resolve_theme_colors;

/// Resolve the theme's base and text colors, returning (bg, fg) hex strings.
/// Uses the theme-colors.json resolved by `resolve_theme_colors`.
/// Falls back to catppuccin-mocha if the theme is not found.
pub fn resolve_initial_theme_colors(
    theme_id: &str,
) -> (String, String) {
    let colors = resolve_theme_colors();
    let fallback = &colors["catppuccin-mocha"];
    let theme = colors.get(theme_id).unwrap_or(fallback);
    let bg = theme["base"].as_str().unwrap_or("#1e1e2e").to_string();
    let fg = theme["text"].as_str().unwrap_or("#cdd6f4").to_string();
    (bg, fg)
}

/// Build the initialization script that sets `window.__INITIAL_THEME__`.
/// This script is meant to be passed to `WebviewWindow::builder().initialization_script()`,
/// so it runs BEFORE the HTML document is parsed — guaranteeing the correct
/// background color on the very first paint.
pub fn build_initialization_script(theme_id: &str) -> String {
    let (bg, fg) = resolve_initial_theme_colors(theme_id);
    format!(
        r#"window.__INITIAL_THEME__={{name:"{}",bg:"{}",fg:"{}"}};"#,
        theme_id, bg, fg
    )
}
