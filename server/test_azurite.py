"""Real Azure SDK/storage protocol tests. Set AZURITE_BIN to azurite-blob."""
import base64
import os
import secrets
import socket
import subprocess
import tempfile
import time
import unittest
from azure.storage.blob import BlobServiceClient
from server.state_store import blob_connect, StateStoreError


@unittest.skipUnless(os.getenv('AZURITE_BIN'), 'Set AZURITE_BIN for Azure storage emulator integration')
class AzuriteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
        key = base64.b64encode(secrets.token_bytes(32)).decode()
        env = dict(os.environ, AZURITE_ACCOUNTS='localtest:' + key)
        cls.proc = subprocess.Popen([os.environ['AZURITE_BIN'], '--silent', '--skipApiVersionCheck', '--blobHost', '127.0.0.1', '--blobPort', str(port), '--location', cls.tmp.name], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        cls.service = BlobServiceClient.from_connection_string(
            f'DefaultEndpointsProtocol=http;AccountName=localtest;AccountKey={key};BlobEndpoint=http://127.0.0.1:{port}/localtest;', retry_total=0, connection_timeout=1, read_timeout=2)
        for _ in range(100):
            try:
                cls.container = cls.service.create_container('playground-state')
                return
            except Exception:
                if cls.proc.poll() is not None:
                    break
                time.sleep(.1)
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
            cls.proc.wait(timeout=3)
        cls.tmp.cleanup()
        raise RuntimeError('Storage emulator failed to start')

    @classmethod
    def tearDownClass(cls):
        cls.service.close()
        cls.proc.terminate()
        try:
            cls.proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            cls.proc.kill()
            cls.proc.wait(timeout=3)
        cls.tmp.cleanup()

    def test_protocol_persistence_and_etag_conflict(self):
        blob = self.container.get_blob_client('state.sqlite3')
        with blob_connect(blob) as db:
            db.execute('CREATE TABLE budget (count INTEGER)')
            db.execute('INSERT INTO budget VALUES (1)')
        # A new SDK client represents an independent process/revision.
        other = self.service.get_blob_client('playground-state', 'state.sqlite3')
        with blob_connect(other) as db:
            self.assertEqual(db.execute('SELECT count FROM budget').fetchone()[0], 1)
        with self.assertRaises(StateStoreError):
            with blob_connect(blob) as stale:
                stale.execute('UPDATE budget SET count=99')
                with blob_connect(other) as current:
                    current.execute('UPDATE budget SET count=2')
        with blob_connect(blob) as db:
            self.assertEqual(db.execute('SELECT count FROM budget').fetchone()[0], 2)
        self.assertIsNone(self.container.get_container_properties().public_access)

    def test_missing_container_does_not_initialize_temporary_state(self):
        blob = self.service.get_blob_client('missing-container', 'state.sqlite3')
        with self.assertRaises(StateStoreError):
            with blob_connect(blob):
                self.fail('Should fail before starting a database transaction')
