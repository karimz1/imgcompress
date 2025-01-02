import logging
import sys
import json

class Logger:
    def __init__(self, debug: bool = False, json_output: bool = False):
        self.debug = debug
        self.json_output = json_output
        self.setup_logging()

    def setup_logging(self):
        self.logging_level = logging.DEBUG if self.debug else logging.INFO
        logging.basicConfig(
            level=self.logging_level,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[logging.StreamHandler(sys.stdout)]
        )

    def log(self, message: str, level: str = "info", **kwargs):
        if self.json_output:
            if level == "debug" and not self.debug:
                return
            output = {"level": level, "message": message, **kwargs}
            print(json.dumps(output))
        else:
            if level == "debug":
                logging.debug(message)
            elif level == "info":
                logging.info(message)
            elif level == "warning":
                logging.warning(message)
            elif level == "error":
                logging.error(message)
            else:
                logging.info(message)
