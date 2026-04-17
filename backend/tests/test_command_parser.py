"""Mission command parser — grammar-driven, perspective-scoped."""

from __future__ import annotations

import unittest

from app.services.command_parser import parse


class ParserHappyPath(unittest.TestCase):
    def test_bare_help(self) -> None:
        out = parse("help", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.verb.key, "help")

    def test_help_with_verb_positional(self) -> None:
        out = parse("help alerts", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.positional["verb"], "alerts")

    def test_two_token_verb(self) -> None:
        out = parse("alerts list", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.verb.key, "alerts list")

    def test_flag_space_separated(self) -> None:
        out = parse(
            "contain session --user user-alice --action revoke",
            perspective="blue",
        )
        self.assertTrue(out.is_ok, out.err.message if out.err else "")
        assert out.ok is not None
        self.assertEqual(out.ok.flags["user"], "user-alice")
        self.assertEqual(out.ok.flags["action"], "revoke")

    def test_flag_equals_form(self) -> None:
        out = parse(
            "contain session --user=user-alice --action=stepup",
            perspective="blue",
        )
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.flags["action"], "stepup")

    def test_csv_flag_parses_list(self) -> None:
        out = parse("correlate --alerts AL-1,AL-2,AL-3", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.flags["alerts"], ["AL-1", "AL-2", "AL-3"])

    def test_int_flag_default_applies(self) -> None:
        out = parse("events tail", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.flags["last"], 10)

    def test_int_flag_override(self) -> None:
        out = parse("events tail --last 3", perspective="blue")
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.flags["last"], 3)


class ParserErrors(unittest.TestCase):
    def test_empty_input_is_empty_error(self) -> None:
        out = parse("   ", perspective="blue")
        self.assertIsNone(out.ok)
        assert out.err is not None
        self.assertEqual(out.err.kind, "empty")

    def test_unknown_verb(self) -> None:
        out = parse("flibber", perspective="blue")
        assert out.err is not None
        self.assertEqual(out.err.kind, "unknown_verb")

    def test_unknown_subcommand_suggests_help(self) -> None:
        out = parse("alerts tornado", perspective="blue")
        assert out.err is not None
        self.assertEqual(out.err.kind, "unknown_subcommand")
        self.assertIn("help alerts", out.err.message)

    def test_missing_required_flag(self) -> None:
        out = parse("contain session --user user-alice", perspective="blue")
        assert out.err is not None
        self.assertEqual(out.err.kind, "missing_flag")
        self.assertIn("--action", out.err.message)

    def test_invalid_choice(self) -> None:
        out = parse(
            "contain session --user user-alice --action nuke",
            perspective="blue",
        )
        assert out.err is not None
        self.assertEqual(out.err.kind, "invalid_flag_value")

    def test_int_flag_rejects_non_integer(self) -> None:
        out = parse("events tail --last many", perspective="blue")
        assert out.err is not None
        self.assertEqual(out.err.kind, "invalid_flag_value")

    def test_flag_without_value(self) -> None:
        out = parse(
            "contain session --user --action revoke", perspective="blue"
        )
        assert out.err is not None
        self.assertEqual(out.err.kind, "invalid_flag_value")


class ParserPerspectiveScope(unittest.TestCase):
    def test_blue_verbs_unavailable_to_red(self) -> None:
        out = parse("alerts list", perspective="red")
        assert out.err is not None
        # Either unknown_verb or unknown_subcommand is acceptable — the
        # important invariant is that it does not parse.
        self.assertIn(out.err.kind, {"unknown_verb", "unknown_subcommand"})

    def test_universal_verbs_available_everywhere(self) -> None:
        self.assertTrue(parse("help", perspective="red").is_ok)
        self.assertTrue(parse("status", perspective="red").is_ok)


class Tokenizing(unittest.TestCase):
    def test_quoted_value_with_spaces(self) -> None:
        out = parse(
            'contain session --user "user alice with spaces" --action revoke',
            perspective="blue",
        )
        self.assertTrue(out.is_ok)
        assert out.ok is not None
        self.assertEqual(out.ok.flags["user"], "user alice with spaces")

    def test_mismatched_quote_reports_tokenize_error(self) -> None:
        out = parse('help "oops', perspective="blue")
        assert out.err is not None
        self.assertEqual(out.err.kind, "tokenize")


if __name__ == "__main__":
    unittest.main()
