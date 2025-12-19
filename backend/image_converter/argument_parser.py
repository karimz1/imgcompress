import argparse

def parse_arguments():
    parser = argparse.ArgumentParser(
        description="imgcompress – image compression CLI & web app"
    )

    subparsers = parser.add_subparsers(
        dest="mode",
        metavar="{cli,web}"
    )

    # Disable subparser help so `cli --help` reaches the CLI parser instead.
    subparsers.add_parser("cli", help="Run CLI mode", add_help=False)
    subparsers.add_parser("web", help="Run web app", add_help=False)

    args, remaining = parser.parse_known_args()

    if args.mode is None:
        parser.print_help()
        parser.exit(0)

    return args, remaining
