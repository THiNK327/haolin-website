"""Small, bounded authentication database snapshots in private Azure Blob Storage.

Each transaction loads SQLite into memory and conditionally replaces the blob on
commit. ETags prevent lost updates across restarts/revisions. This deliberately
trades throughput for low idle cost; do not use it for a large or multi-replica API.
No SQLite file is opened on a network filesystem. No map data is stored here.
"""
import os
import sqlite3
from contextlib import contextmanager
from functools import lru_cache
from azure.core import MatchConditions
from azure.core.exceptions import AzureError, ResourceNotFoundError
from azure.storage.blob import BlobClient, ContentSettings

MAX_STATE_BYTES = 8 * 1024 * 1024


class StateStoreError(Exception):
    pass


@lru_cache(maxsize=1)
def blob_client():
    connection = os.getenv('AZURE_STORAGE_CONNECTION_STRING', '')
    if not connection:
        raise StateStoreError('Storage is not configured.')
    return BlobClient.from_connection_string(
        connection,
        container_name=os.getenv('AZURE_STORAGE_CONTAINER', 'playground-state'),
        blob_name='auth.sqlite3',
        retry_total=0, connection_timeout=5, read_timeout=5,
        max_single_get_size=MAX_STATE_BYTES,
    )


@contextmanager
def blob_connect(client=None):
    client = client if client is not None else blob_client()
    db = sqlite3.connect(':memory:')
    db.row_factory = sqlite3.Row
    try:
        try:
            props = client.get_blob_properties()
        except ResourceNotFoundError as exc:
            # A missing container/configuration must not silently reset quotas.
            if exc.error_code != 'BlobNotFound':
                raise
            raw, etag = None, None
        else:
            if props.size > MAX_STATE_BYTES:
                raise StateStoreError('State exceeds the configured limit.')
            etag = props.etag
            raw = client.download_blob(etag=etag, match_condition=MatchConditions.IfNotModified).readall()
            db.deserialize(raw)
        db.execute("PRAGMA secure_delete=ON")
        with db:
            yield db
        # serialize requires a nonempty database (the API creates its schema).
        updated = db.serialize()
        if raw != updated:
            if len(updated) > MAX_STATE_BYTES:
                raise StateStoreError('State exceeds the configured limit.')
            conditions = {'overwrite': False} if etag is None else {
                'overwrite': True, 'etag': etag,
                'match_condition': MatchConditions.IfNotModified,
            }
            client.upload_blob(updated, content_settings=ContentSettings(
                content_type='application/vnd.sqlite3', cache_control='no-store'), **conditions)
    except AzureError as exc:
        # No retries of SQL or external effects: conflicts/outages fail closed.
        raise StateStoreError('Durable state unavailable.') from exc
    finally:
        db.close()
