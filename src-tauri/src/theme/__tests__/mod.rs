use crate::theme::colors::{parse_hex_color, resolve_theme_colors, theme_to_color};

mod colors {
    use super::*;

    #[test]
    fn parse_hex_color_with_hash() {
        let (r, g, b) = parse_hex_color("#1e1e2e");
        assert_eq!((r, g, b), (0x1e, 0x1e, 0x2e));
    }

    #[test]
    fn parse_hex_color_without_hash() {
        let (r, g, b) = parse_hex_color("cdd6f4");
        assert_eq!((r, g, b), (0xcd, 0xd6, 0xf4));
    }

    #[test]
    fn parse_hex_color_white() {
        let (r, g, b) = parse_hex_color("#ffffff");
        assert_eq!((r, g, b), (255, 255, 255));
    }

    #[test]
    fn parse_hex_color_black() {
        let (r, g, b) = parse_hex_color("#000000");
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn parse_hex_color_invalid_returns_zero() {
        let (r, g, b) = parse_hex_color("zzzzzz");
        assert_eq!((r, g, b), (0, 0, 0));
    }

    #[test]
    fn resolve_theme_colors_returns_object() {
        let colors = resolve_theme_colors();
        assert!(colors.is_object());
        assert!(colors.get("catppuccin-mocha").is_some());
    }

    #[test]
    fn theme_to_color_returns_known_catppuccin() {
        let color = theme_to_color("catppuccin-mocha");
        assert_eq!(color.0, 0x1e);
        assert_eq!(color.1, 0x1e);
        assert_eq!(color.2, 0x2e);
        assert_eq!(color.3, 255);
    }

    #[test]
    fn theme_to_color_unknown_falls_back_to_catppuccin() {
        let known = theme_to_color("catppuccin-mocha");
        let unknown = theme_to_color("nonexistent-theme");
        assert_eq!(known.0, unknown.0);
        assert_eq!(known.1, unknown.1);
        assert_eq!(known.2, unknown.2);
    }
}
