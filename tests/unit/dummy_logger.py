class DummyLogger:
    def __init__(self, *args, **kwargs):
        self.messages = []

    def log(self, message):
        self.messages.append(message)
