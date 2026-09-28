"""Persistence, lost-update prevention and failure behavior without cloud secrets."""
import sqlite3
import unittest
from types import SimpleNamespace
from azure.core.exceptions import ResourceNotFoundError, ResourceModifiedError, ServiceRequestError
from server.state_store import blob_connect, StateStoreError


class FakeBlob:
    def __init__(self):
        self.raw = None
        self.version = 0
        self.fail = False

    def get_blob_properties(self):
        if self.fail:
            raise ServiceRequestError('unavailable')
        if self.raw is None:
            err = ResourceNotFoundError('missing')
            err.error_code = 'BlobNotFound'
            raise err
        return SimpleNamespace(size=len(self.raw), etag=str(self.version))

    def download_blob(self, **kwargs):
        if kwargs['etag'] != str(self.version):
            raise ResourceModifiedError('conflict')
        raw = self.raw
        return SimpleNamespace(readall=lambda: raw)

    def upload_blob(self, raw, **kwargs):
        if self.fail:
            raise ServiceRequestError('unavailable')
        if self.raw is not None and (not kwargs['overwrite'] or kwargs.get('etag') != str(self.version)):
            raise ResourceModifiedError('conflict')
        self.raw = raw
        self.version += 1


class StateTests(unittest.TestCase):
    def setUp(self):
        self.blob = FakeBlob()
        with blob_connect(self.blob) as db:
            db.execute('CREATE TABLE budget (count INTEGER)')
            db.execute('INSERT INTO budget VALUES (0)')

    def count(self):
        with blob_connect(self.blob) as db:
            return db.execute('SELECT count FROM budget').fetchone()[0]

    def test_persistence_read_only_and_rollback(self):
        with blob_connect(self.blob) as db:
            db.execute('UPDATE budget SET count=1')
        version = self.blob.version
        self.assertEqual(self.count(), 1)
        self.assertEqual(self.blob.version, version)
        with self.assertRaises(ValueError):
            with blob_connect(self.blob) as db:
                db.execute('UPDATE budget SET count=9')
                raise ValueError('rollback')
        self.assertEqual(self.count(), 1)

    def test_stale_writer_cannot_overwrite_committed_budget(self):
        with self.assertRaises(StateStoreError):
            with blob_connect(self.blob) as stale:
                stale.execute('UPDATE budget SET count=99')
                with blob_connect(self.blob) as current:
                    current.execute('UPDATE budget SET count=1')
        self.assertEqual(self.count(), 1)

    def test_outage_fails_closed(self):
        self.blob.fail = True
        with self.assertRaises(StateStoreError):
            self.count()
        self.blob.fail = False
        with self.assertRaises(StateStoreError):
            with blob_connect(self.blob) as db:
                db.execute('UPDATE budget SET count=9')
                self.blob.fail = True
        self.blob.fail = False
        self.assertEqual(self.count(), 0)

    def test_corrupt_snapshot_is_not_reset(self):
        self.blob.raw = b'not a sqlite database'
        with self.assertRaises(sqlite3.Error):
            self.count()
        self.assertEqual(self.blob.raw, b'not a sqlite database')


if __name__ == '__main__':
    unittest.main()
