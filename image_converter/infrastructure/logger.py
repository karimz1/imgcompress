import logging
import sys
from colorama import Fore, Style


class Logger:
    def __init__(self, debug: bool = False, json_output: bool = False):
        self.debug = debug
        self.json_output = json_output
        self.logs = []
        self._setup_logger()

    def _setup_logger(self):
        self.logger = logging.getLogger(__name__)
        self.logger.handlers = []
        self.logger.propagate = False
        self.logger.setLevel(logging.DEBUG if self.debug else logging.INFO)

        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter("%(message)s"))
        self.logger.addHandler(handler)

    def log(self, message: str, level: str = "info", **kwargs):
        if self._should_skip_debug(level):
            return
        if self.json_output:
            self._store_json_log(message, level, **kwargs)
        else:
            self._log_plain_text(message, level)

    def _should_skip_debug(self, level: str) -> bool:
        return level == "debug" and not self.debug

    def _store_json_log(self, message: str, level: str, **kwargs):
        log_entry = {"level": level, "message": message, **kwargs}
        self.logs.append(log_entry)

    def _log_plain_text(self, message: str, level: str):
        colored = self._colorize_message(message, level)
        if level == "debug":
            self.logger.debug(colored)
        elif level == "info":
            self.logger.info(colored)
        elif level == "warning":
            self.logger.warning(colored)
        elif level == "error":
            self.logger.error(colored)

    def _colorize_message(self, message: str, level: str) -> str:
        if level == "error":
            return f"{Fore.RED}{message}{Style.RESET_ALL}"
        if level == "info":
            return f"{Fore.GREEN}{message}{Style.RESET_ALL}"
        if level == "warning":
            return f"{Fore.YELLOW}{message}{Style.RESET_ALL}"
        if level == "debug":
            return f"{Fore.CYAN}{message}{Style.RESET_ALL}"
        return message
