import argparse

def parse_arguments():
    parser = argparse.ArgumentParser(
        description="imgcompress – image compression CLI & web app"
    )

    subparsers = parser.add_subparsers(
        dest="mode",
        metavar="{cli,web}"
    )

    subparsers.add_parser("cli", help="Run CLI mode")
    subparsers.add_parser("web", help="Run web app")

    args, remaining = parser.parse_known_args()

    if args.mode is None:
        parser.print_help()
        parser.exit(0)

    return args, remaining
